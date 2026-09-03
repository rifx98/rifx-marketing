import type { SupabaseClient } from '@supabase/supabase-js';

export type ConversationFilter =
  | 'all'
  | 'unread'
  | 'open'
  | 'closed'
  | 'human'
  | 'bot'
  | 'unassigned';

export async function listConversations(
  db: SupabaseClient,
  tenantId: string,
  input: {
    accountId?: string;
    filter?: ConversationFilter;
    assignedAgentId?: string;
    search?: string;
    limit?: number;
  } = {},
) {
  let query = db
    .from('conversations')
    .select('*, team_agents(id,name,email,role,status), whatsapp_accounts(id,name,phone_number,phone_number_id)')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(Math.min(Math.max(input.limit || 100, 1), 250));

  if (input.accountId) query = query.eq('whatsapp_account_id', input.accountId);
  if (input.assignedAgentId) query = query.eq('assigned_agent_id', input.assignedAgentId);

  switch (input.filter) {
    case 'unread': query = query.gt('unread_count', 0); break;
    case 'open': query = query.eq('status', 'open'); break;
    case 'closed': query = query.eq('status', 'closed'); break;
    case 'human': query = query.eq('bot_paused', true); break;
    case 'bot': query = query.eq('bot_paused', false); break;
    case 'unassigned': query = query.is('assigned_agent_id', null); break;
  }

  if (input.search?.trim()) {
    const q = input.search.trim().replace(/[%(),]/g, '');
    query = query.or(`phone_number.ilike.%${q}%,last_message_preview.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function assignConversation(
  db: SupabaseClient,
  tenantId: string,
  conversationId: string,
  agentId: string | null,
) {
  if (agentId) {
    const { data: agent, error: agentError } = await db
      .from('team_agents')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', agentId)
      .maybeSingle();
    if (agentError) throw agentError;
    if (!agent) throw new Error('El asesor no pertenece al tenant.');
  }

  const { data, error } = await db
    .from('conversations')
    .update({ assigned_agent_id: agentId, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', conversationId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Conversación no encontrada.');
  return data;
}

export async function setConversationBotPaused(
  db: SupabaseClient,
  tenantId: string,
  conversationId: string,
  paused: boolean,
) {
  const { data, error } = await db
    .from('conversations')
    .update({
      bot_paused: paused,
      is_human_mode: paused,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', conversationId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Conversación no encontrada.');
  return data;
}

export async function markConversationRead(db: SupabaseClient, tenantId: string, conversationId: string) {
  const { error } = await db
    .from('conversations')
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', conversationId);
  if (error) throw error;
}

export async function updateConversationProfile(
  db: SupabaseClient,
  tenantId: string,
  conversationId: string,
  patch: { tags?: string[]; notes?: string; customFields?: Record<string, unknown> },
) {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.tags) payload.tags = [...new Set(patch.tags.map(x => x.trim()).filter(Boolean))];
  if (patch.notes !== undefined) payload.notes = patch.notes;
  if (patch.customFields) payload.custom_fields = patch.customFields;

  const { data, error } = await db
    .from('conversations')
    .update(payload)
    .eq('tenant_id', tenantId)
    .eq('id', conversationId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Conversación no encontrada.');
  return data;
}
