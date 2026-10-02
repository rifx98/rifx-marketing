import fs from 'fs';
import path from 'path';
import { createSupabaseAdmin } from './supabase';

export interface BrainKnowledgeItem {
  id: string;
  tenantId: string;
  title: string;
  content: string;
  category: 'general' | 'sales' | 'objections' | 'product' | 'process' | 'scripts' | 'faq' | 'competitor';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const KNOWLEDGE_FILE = path.join(DATA_DIR, 'brain-knowledge.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAllKnowledgeFromFile(): Record<string, BrainKnowledgeItem[]> {
  ensureDataDir();
  if (!fs.existsSync(KNOWLEDGE_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(KNOWLEDGE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[brain-knowledge-store] Error reading file:', err);
    return {};
  }
}

function writeAllKnowledgeToFile(data: Record<string, BrainKnowledgeItem[]>): void {
  ensureDataDir();
  try {
    fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[brain-knowledge-store] Error writing file:', err);
  }
}

/**
 * Get all active knowledge items for a tenant
 */
/**
 * Get all active knowledge items for a tenant
 */
export async function getTenantKnowledge(tenantId: string): Promise<BrainKnowledgeItem[]> {
  const all = readAllKnowledgeFromFile();
  const items = all[tenantId] || [];
  return items.filter((i) => i.active);
}

/**
 * Get all active knowledge items across all tenants (for global admin brain view)
 */
export async function getAllKnowledge(): Promise<BrainKnowledgeItem[]> {
  const all = readAllKnowledgeFromFile();
  const items: BrainKnowledgeItem[] = [];
  for (const list of Object.values(all)) {
    if (Array.isArray(list)) {
      items.push(...list.filter((i) => i.active));
    }
  }
  return items;
}

/**
 * Save or update a knowledge item
 */
export async function saveTenantKnowledge(
  tenantId: string,
  item: {
    id?: string;
    title: string;
    content: string;
    category?: BrainKnowledgeItem['category'];
  }
): Promise<BrainKnowledgeItem> {
  const all = readAllKnowledgeFromFile();
  if (!all[tenantId]) {
    all[tenantId] = [];
  }

  const now = new Date().toISOString();
  const existingIndex = item.id ? all[tenantId].findIndex((i) => i.id === item.id) : -1;

  let savedItem: BrainKnowledgeItem;

  if (existingIndex >= 0) {
    savedItem = {
      ...all[tenantId][existingIndex],
      title: item.title.trim(),
      content: item.content.trim(),
      category: item.category || all[tenantId][existingIndex].category || 'general',
      updatedAt: now,
    };
    all[tenantId][existingIndex] = savedItem;
  } else {
    savedItem = {
      id: item.id || `bk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      title: item.title.trim(),
      content: item.content.trim(),
      category: item.category || 'general',
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    all[tenantId].unshift(savedItem);
  }

  writeAllKnowledgeToFile(all);

  // Sync to config.ai_prompt so WhatsApp bot and Voice calls use it immediately
  await syncKnowledgeToAIPrompt(tenantId).catch((err) => {
    console.warn('[brain-knowledge-store] Error syncing to ai_prompt:', err);
  });

  return savedItem;
}

/**
 * Delete a knowledge item
 */
export async function deleteTenantKnowledge(tenantId: string, itemId: string): Promise<boolean> {
  const all = readAllKnowledgeFromFile();
  if (!all[tenantId]) return false;

  const initialLength = all[tenantId].length;
  all[tenantId] = all[tenantId].filter((i) => i.id !== itemId);
  writeAllKnowledgeToFile(all);

  if (all[tenantId].length !== initialLength) {
    await syncKnowledgeToAIPrompt(tenantId).catch((err) => {
      console.warn('[brain-knowledge-store] Error syncing to ai_prompt after delete:', err);
    });
    return true;
  }
  return false;
}

const KNOWLEDGE_SECTION_DELIMITER = '\n\n=== [CONOCIMIENTO Y REGLAS DE NEGOCIO APRENDIDAS POR EL CEREBRO] ===';

/**
 * Synchronizes custom brain knowledge into config.ai_prompt
 * This guarantees that:
 * 1. The WhatsApp bot (app/api/whatsapp) uses this knowledge.
 * 2. Voice calls (Twilio/Vapi) use this knowledge.
 * 3. Follow-up automated crons use this knowledge.
 */
export async function syncKnowledgeToAIPrompt(tenantId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const { data: config } = await supabase
    .from('config')
    .select('ai_prompt')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const currentPrompt = (config?.ai_prompt as string) || '';
  const items = await getTenantKnowledge(tenantId);

  // Strip previous knowledge section if already present
  const basePrompt = currentPrompt.includes(KNOWLEDGE_SECTION_DELIMITER)
    ? currentPrompt.split(KNOWLEDGE_SECTION_DELIMITER)[0].trim()
    : currentPrompt.trim();

  if (items.length === 0) {
    // Just restore base prompt
    await supabase
      .from('config')
      .update({ ai_prompt: basePrompt })
      .eq('tenant_id', tenantId);
    return;
  }

  // Format knowledge concisely for token efficiency in WhatsApp & Voice
  const formattedLines: string[] = [
    KNOWLEDGE_SECTION_DELIMITER,
    'Usa estas instrucciones y reglas estratégicas para responder y tomar decisiones en chats y llamadas:',
  ];

  for (const item of items) {
    formattedLines.push(`• [${item.category.toUpperCase()}] ${item.title}: ${item.content}`);
  }

  const updatedPrompt = `${basePrompt}\n\n${formattedLines.join('\n')}`.trim();

  // Cap at 38,000 characters to ensure safe fit in DB column
  const finalPrompt = updatedPrompt.length > 38000 ? updatedPrompt.substring(0, 38000) : updatedPrompt;

  await supabase
    .from('config')
    .update({ ai_prompt: finalPrompt })
    .eq('tenant_id', tenantId);

  console.log(`[brain-knowledge-store] Synced ${items.length} knowledge items to config.ai_prompt for tenant ${tenantId}`);
}
