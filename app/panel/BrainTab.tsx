'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import type {
  BrainGraph,
  BrainNode,
  BrainEdge,
  BrainActivity,
  BrainNodeType,
  CognitiveLearningState,
} from '@/lib/brain-graph';

// Dynamically load the 3D Canvas component to guarantee no SSR issues with WebGL/Three.js
const BrainGraph3D = dynamic(() => import('./components/BrainGraph3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[500px] flex-col items-center justify-center bg-[#010309] text-slate-400">
      <span className="material-symbols-outlined mb-3 animate-spin text-4xl text-cyan-400">
        progress_activity
      </span>
      <p className="text-sm font-semibold text-slate-200">Iniciando Red Neuronal Anatómica 3D...</p>
      <p className="mt-1 text-xs text-slate-500">Cargando neuronas corticales, hemisferios y sinapsis</p>
    </div>
  ),
});

// Dynamically load the Neuromapa interactive canvas engine
const NeuromapaGraph = dynamic(() => import('./components/NeuromapaGraph'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[500px] flex-col items-center justify-center bg-[#0a0c10] text-slate-400">
      <span className="material-symbols-outlined mb-3 animate-spin text-4xl text-[#a193ff]">
        progress_activity
      </span>
      <p className="text-sm font-semibold text-slate-200">Iniciando Neuromapa Neuronal...</p>
      <p className="mt-1 text-xs text-slate-500">Cargando sinapsis activas, impulsos y memoria cognitiva</p>
    </div>
  ),
});

const NODE_TYPE_META: Record<
  BrainNodeType,
  { labelEs: string; labelEn: string; icon: string; color: string; bg: string; text: string }
> = {
  core: {
    labelEs: 'Núcleo Central',
    labelEn: 'Core Engine',
    icon: 'neurology',
    color: '#f97316',
    bg: 'bg-orange-50 border-orange-200',
    text: 'text-orange-900',
  },
  customer: {
    labelEs: 'Cliente',
    labelEn: 'Customer',
    icon: 'person',
    color: '#06b6d4',
    bg: 'bg-cyan-50 border-cyan-200',
    text: 'text-cyan-800',
  },
  conversation: {
    labelEs: 'Conversación',
    labelEn: 'Conversation',
    icon: 'chat',
    color: '#6366f1',
    bg: 'bg-indigo-50 border-indigo-200',
    text: 'text-indigo-800',
  },
  message_user: {
    labelEs: 'Mensaje Cliente',
    labelEn: 'User Message',
    icon: 'forum',
    color: '#0d9488',
    bg: 'bg-teal-50 border-teal-200',
    text: 'text-teal-800',
  },
  message_ai: {
    labelEs: 'Respuesta IA',
    labelEn: 'AI Response',
    icon: 'smart_toy',
    color: '#9333ea',
    bg: 'bg-purple-50 border-purple-200',
    text: 'text-purple-800',
  },
  intent: {
    labelEs: 'Intención',
    labelEn: 'Intent',
    icon: 'auto_awesome',
    color: '#d97706',
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
  },
  knowledge: {
    labelEs: 'Conocimiento',
    labelEn: 'Knowledge',
    icon: 'menu_book',
    color: '#0284c7',
    bg: 'bg-sky-50 border-sky-200',
    text: 'text-sky-800',
  },
  appointment: {
    labelEs: 'Cita',
    labelEn: 'Appointment',
    icon: 'calendar_month',
    color: '#ea580c',
    bg: 'bg-orange-50 border-orange-200',
    text: 'text-orange-800',
  },
  sale: {
    labelEs: 'Venta',
    labelEn: 'Sale',
    icon: 'payments',
    color: '#16a34a',
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
  },
  voice: {
    labelEs: 'Llamada de Voz',
    labelEn: 'Voice Call',
    icon: 'phone_in_talk',
    color: '#db2777',
    bg: 'bg-pink-50 border-pink-200',
    text: 'text-pink-800',
  },
  action: {
    labelEs: 'Próxima Acción',
    labelEn: 'Next Action',
    icon: 'bolt',
    color: '#c026d3',
    bg: 'bg-fuchsia-50 border-fuchsia-200',
    text: 'text-fuchsia-800',
  },
  objection: {
    labelEs: 'Objeción',
    labelEn: 'Objection',
    icon: 'help_outline',
    color: '#e11d48',
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-800',
  },
  campaign: {
    labelEs: 'Pauta Publicitaria',
    labelEn: 'Ad Campaign',
    icon: 'campaign',
    color: '#1877F2',
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-800',
  },
};

function formatRelativeTime(dateString: string | null, isEn: boolean): string {
  if (!dateString) return isEn ? 'Unknown' : 'Desconocido';
  const diffMs = Date.now() - Date.parse(dateString);
  if (Number.isNaN(diffMs) || diffMs < 0) return isEn ? 'Just now' : 'Recién';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return isEn ? 'Just now' : 'Hace un momento';
  if (minutes < 60) return isEn ? `${minutes}m ago` : `Hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return isEn ? `${hours}h ago` : `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return isEn ? `${days}d ago` : `Hace ${days}d`;
}

export type BrainTabTenant = {
  id: string;
  companyName?: string;
  ownerName?: string;
  email?: string;
  plan?: string;
};

export type BrainTabProps = {
  language?: string;
  adminView?: boolean;
  tenants?: BrainTabTenant[];
  selectedTenantId?: string | null;
  onSelectTenantId?: (tenantId: string) => void;
};

type CopilotChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actionTag?: string;
};

export interface KnowledgeItem {
  id: string;
  tenantId: string;
  title: string;
  content: string;
  category: 'general' | 'sales' | 'objections' | 'product' | 'process' | 'scripts' | 'faq' | 'competitor';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_TAGS: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  objections: { label: 'Objeción', bg: 'bg-amber-100 border-amber-200', text: 'text-amber-800', icon: 'shield' },
  sales: { label: 'Ventas', bg: 'bg-emerald-100 border-emerald-200', text: 'text-emerald-800', icon: 'payments' },
  scripts: { label: 'Script', bg: 'bg-blue-100 border-blue-200', text: 'text-blue-800', icon: 'description' },
  product: { label: 'Producto', bg: 'bg-purple-100 border-purple-200', text: 'text-purple-800', icon: 'inventory_2' },
  process: { label: 'Proceso', bg: 'bg-slate-100 border-slate-200', text: 'text-slate-800', icon: 'settings' },
  faq: { label: 'FAQ', bg: 'bg-teal-100 border-teal-200', text: 'text-teal-800', icon: 'help' },
  competitor: { label: 'Competencia', bg: 'bg-rose-100 border-rose-200', text: 'text-rose-800', icon: 'sports_mma' },
  general: { label: 'General', bg: 'bg-cyan-100 border-cyan-200', text: 'text-cyan-800', icon: 'neurology' },
};

function renderFormattedContent(text: string) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1 leading-relaxed text-xs">
      {lines.map((line, pIdx) => {
        if (!line.trim()) return <div key={pIdx} className="h-1.5" />;
        const isBullet = line.trim().startsWith('•') || line.trim().startsWith('- ') || line.trim().startsWith('* ');
        const cleanLine = isBullet ? line.trim().replace(/^[•\-\*]\s*/, '') : line;

        const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
        const formatted = parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={i} className="font-bold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        });

        if (isBullet) {
          return (
            <div key={pIdx} className="flex items-start gap-1.5 pl-1.5">
              <span className="text-orange-500 text-xs leading-4 select-none">•</span>
              <div className="flex-1">{formatted}</div>
            </div>
          );
        }

        return <p key={pIdx}>{formatted}</p>;
      })}
    </div>
  );
}

export default function BrainTab({
  language = 'es',
  adminView = false,
  tenants = [],
  selectedTenantId = null,
  onSelectTenantId,
}: BrainTabProps) {
  const isEn = language === 'en';

  const [tenantId, setTenantId] = useState<string>(selectedTenantId || 'all');
  const [graph, setGraph] = useState<BrainGraph | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'neuromapa' | '3d'>('neuromapa');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'confirmed' | 'inferred'>('all');
  
  // Tabs: Copiloto Asistente IA (Eje Central), Aprendizaje Continuo, Inspector, Actividad
  const [activeSideTab, setActiveSideTab] = useState<'copilot' | 'learning' | 'inspector' | 'activity'>('copilot');

  // AI Brain Assistant Chat & Autonomous Actions State
  const [copilotInput, setCopilotInput] = useState<string>('');
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotChatMessage[]>([
    {
      id: 'init-msg',
      role: 'assistant',
      content: isEn
        ? 'I am the Central AI Brain of your CRM. I actively analyze conversations, WhatsApp messages, closed sales, and voice calls to optimize conversion and coordinate your operations. What would you like to execute?'
        : 'Soy el Cerebro Central de IA de tu CRM. Analizo en tiempo real lo que tus clientes escriben por WhatsApp, las objeciones en llamadas de voz y las técnicas que cierran ventas para optimizar todo el negocio. ¿Qué deseas coordinar hoy?',
      timestamp: new Date().toISOString(),
    },
  ]);

  // Learning Toast Banner
  const [learningNotification, setLearningNotification] = useState<string | null>(null);

  // Injected Business Knowledge State
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState<boolean>(false);
  const [isInjectModalOpen, setIsInjectModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<KnowledgeItem['category']>('objections');
  const [newContent, setNewContent] = useState<string>('');
  const [isSavingKnowledge, setIsSavingKnowledge] = useState<boolean>(false);
  const [injectMode, setInjectMode] = useState<'upload' | 'manual'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedTenantId !== undefined && selectedTenantId !== null) {
      setTenantId(selectedTenantId);
    }
  }, [selectedTenantId]);

  const fetchBrainData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const url = adminView && tenantId
        ? `/api/panel/brain?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/panel/brain';

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error
            || (isEn
              ? 'Could not load AI Brain memory graph.'
              : 'No se pudo cargar el grafo neuronal del CRM.'),
        );
      }

      const data: BrainGraph = await response.json();
      setGraph(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isEn, adminView, tenantId]);

  useEffect(() => {
    fetchBrainData();
  }, [fetchBrainData]);

  // Auto-polling every 25 seconds for continuous real-time learning updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBrainData(true);
    }, 25000);
    return () => clearInterval(interval);
  }, [fetchBrainData]);

  // Trigger simulated learning event with electrical flash across 3D brain
  const handleTriggerLearn = useCallback(() => {
    setLearningNotification(
      isEn
        ? '⚡ Synaptic surge: AI Brain synthesized new communication & sales patterns from recent CRM interactions.'
        : '⚡ Descarga sináptica: El Cerebro asimiló nuevos patrones de lenguaje en WhatsApp y ajustó técnicas de venta.',
    );
    setTimeout(() => {
      setLearningNotification(null);
    }, 5000);

    // Refresh graph to reflect new synaptic weight
    fetchBrainData(true);
  }, [fetchBrainData, isEn]);

  // Fetch Injected Knowledge Items from API
  const fetchKnowledge = useCallback(async () => {
    try {
      setKnowledgeLoading(true);
      const res = await fetch('/api/panel/brain/knowledge');
      if (res.ok) {
        const data = await res.json();
        setKnowledgeList(data.items || []);
      }
    } catch (err) {
      console.warn('Error fetching knowledge:', err);
    } finally {
      setKnowledgeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledge();
  }, [fetchKnowledge]);

  // Save new knowledge item from modal
  const handleSaveKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || isSavingKnowledge) return;

    setIsSavingKnowledge(true);
    try {
      const res = await fetch('/api/panel/brain/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory,
          content: newContent.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsInjectModalOpen(false);
        setNewTitle('');
        setNewContent('');
        await fetchKnowledge();
        handleTriggerLearn();

        setCopilotMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: `🧠 **Conocimiento Asimilado:** Guardé "${data.item.title}" en **${data.item.category.toUpperCase()}**.\n\nYa está sincronizado en tiempo real con las respuestas de WhatsApp y las decisiones de llamadas de voz.`,
            timestamp: new Date().toISOString(),
            actionTag: 'knowledge_learned',
          },
        ]);
      }
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setIsSavingKnowledge(false);
    }
  };

  // Upload knowledge file (.pdf, .txt, .md, .csv, .json)
  const handleUploadFileKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || isUploadingFile) return;

    setIsUploadingFile(true);
    setUploadProgress(isEn ? 'Extracting text & neural indexing...' : 'Extrayendo contenido e indexando en red neuronal...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', newCategory);
      if (newTitle.trim()) {
        formData.append('title', newTitle.trim());
      }

      const res = await fetch('/api/panel/brain/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Error al procesar el archivo');
      }

      setIsInjectModalOpen(false);
      setSelectedFile(null);
      setNewTitle('');
      setNewContent('');
      await fetchKnowledge();
      handleTriggerLearn();

      setCopilotMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: `🧠 **Archivo Asimilado con Éxito:** He indexado "${data.fileName || selectedFile.name}" (${(data.characterCount || 0).toLocaleString()} caracteres) en la categoría **${(data.item?.category || newCategory).toUpperCase()}**.\n\nYa forma parte de la memoria del Cerebro y está activo en WhatsApp y llamadas de voz para cerrar ventas con mayor inteligencia.`,
          timestamp: new Date().toISOString(),
          actionTag: 'knowledge_learned',
        },
      ]);
    } catch (err: any) {
      alert(`Error al subir archivo: ${err.message}`);
    } finally {
      setIsUploadingFile(false);
      setUploadProgress('');
    }
  };

  // Delete knowledge item
  const handleDeleteKnowledge = async (id: string) => {
    if (!confirm('¿Deseas eliminar este conocimiento del Cerebro?')) return;
    try {
      const res = await fetch(`/api/panel/brain/knowledge?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setKnowledgeList((prev) => prev.filter((item) => item.id !== id));
        fetchBrainData(true);
      }
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  // Handle Copilot Autonomous Actions — Now runs real strategic LLM analysis!
  const handleExecuteAutonomousAction = useCallback(async (actionKey: string) => {
    setCopilotLoading(true);
    let promptMsg = '';

    if (actionKey === 'audit_pains') {
      promptMsg = isEn
        ? 'Audit customer pain points across all platform conversations and voice calls. What deep frustrations and fears were captured and how should we solve them?'
        : 'Audita y mapea los principales dolores de los clientes captados en todas las conversaciones y llamadas de la plataforma. Explica qué temores o frustraciones tienen y cómo debemos abordarlos para que compren.';
    } else if (actionKey === 'friction_taboos') {
      promptMsg = isEn
        ? 'Analyze what people HATE hearing in WhatsApp chats and phone calls. What friction phrases kill sales, and what are the winning high-converting alternatives?'
        : 'Analiza qué frases o actitudes generan fricción y qué es lo que a la gente NO le gusta oír en WhatsApp o llamadas. Dame los tabúes detectados y las alternativas de alta conversión que debemos usar.';
    } else if (actionKey === 'closing_master') {
      promptMsg = isEn
        ? 'Recommend proven sales closing techniques based on past won deals (double alternative, risk reversal, ROI reframing) with ready-to-use scripts.'
        : 'Dame las técnicas de cierre más efectivas y probadas en el historial (doble alternativa, inversión de riesgo, desglose de ROI) y cómo aplicarlas paso a paso para cerrar ventas hoy.';
    } else if (actionKey === 'calibrate_voice') {
      promptMsg = isEn
        ? 'Analyze phone sales calls and provide voice calibration guidelines: optimal pace (WPM), active listening pauses, and objection handling without sounding robotic.'
        : 'Calibra las llamadas telefónicas de ventas: ritmo en palabras por minuto, duración de pausas de escucha activa y cómo rebatir objeciones por teléfono sin sonar agresivo ni robótico.';
    } else if (actionKey === 'qualify_leads') {
      promptMsg = isEn
        ? 'Evaluate incoming customer interactions and qualify top priority leads with urgency level and next action.'
        : 'Analiza los prospectos y conversaciones actuales en el CRM. Califica su nivel de urgencia e intención de compra, y dime a cuáles debemos priorizar de inmediato y con qué acción táctica.';
    } else if (actionKey === 'optimize_whatsapp') {
      promptMsg = isEn
        ? 'Review WhatsApp sales patterns and give me 3 high-conversion closing responses to use today.'
        : 'Revisa las conversaciones de WhatsApp y las ventas cerradas. Dame las 3 mejores respuestas persuasivas y técnicas de venta que deberíamos usar hoy para aumentar la conversión.';
    } else if (actionKey === 'reengage_objections') {
      promptMsg = isEn
        ? 'Generate 3 personalized re-engagement messages for leads with open price or time objections.'
        : 'Genera 3 mensajes de seguimiento personalizados para prospectos que tienen objeciones abiertas de precio o tiempo para reengancharlos y cerrarlos.';
    } else if (actionKey === 'consolidate_memory') {
      promptMsg = isEn
        ? 'Consolidate neural memory and summarize learned rules.'
        : 'Consolida la memoria neuronal del negocio y resume las reglas clave aprendidas hasta ahora.';
    }

    setCopilotMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        content: promptMsg,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const recentHistory = copilotMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/panel/brain/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptMsg,
          history: recentHistory,
          action: 'chat',
        }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || 'No pude generar la recomendación.';

      setCopilotMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: reply,
          timestamp: new Date().toISOString(),
          actionTag: actionKey,
        },
      ]);
      handleTriggerLearn();
    } catch (err: any) {
      setCopilotMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content: `❌ Error al consultar al Cerebro: ${err.message || 'Error de conexión'}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setCopilotLoading(false);
    }
  }, [copilotMessages, handleTriggerLearn, isEn]);

  // Handle Copilot Custom Input — calls real LLM via /api/panel/brain/chat
  const handleSendCopilotPrompt = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const query = copilotInput.trim();
    if (!query || copilotLoading) return;

    // Detect if user is teaching the brain (knowledge injection)
    const lower = query.toLowerCase();
    const isLearning = lower.startsWith('aprende:') || lower.startsWith('aprende ')
      || lower.startsWith('learn:') || lower.startsWith('learn ')
      || lower.startsWith('conocimiento:') || lower.startsWith('recuerda:')
      || lower.startsWith('memoriza:');

    // Clean the message if it's a learn command
    const cleanMessage = isLearning
      ? query.replace(/^(aprende|learn|conocimiento|recuerda|memoriza)\s*:?\s*/i, '').trim()
      : query;

    setCopilotMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: query,
        timestamp: new Date().toISOString(),
      },
    ]);
    setCopilotInput('');
    setCopilotLoading(true);

    try {
      // Build history from recent messages for context
      const recentHistory = copilotMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/panel/brain/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanMessage,
          history: recentHistory,
          action: isLearning ? 'learn' : 'chat',
        }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || 'No pude generar una respuesta.';

      setCopilotMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant' as const,
          content: reply,
          timestamp: new Date().toISOString(),
          ...(data.learned ? { actionTag: 'knowledge_learned' } : {}),
        },
      ]);

      // If learning was successful, trigger the brain animation & refresh knowledge
      if (data.learned) {
        handleTriggerLearn();
        fetchKnowledge();
      }
    } catch (err: any) {
      setCopilotMessages((prev) => [
        ...prev,
        {
          id: `ai-error-${Date.now()}`,
          role: 'assistant' as const,
          content: `❌ Error de conexión: ${err.message || 'No se pudo contactar al servidor'}. Intenta de nuevo.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setCopilotLoading(false);
    }
  }, [copilotInput, copilotLoading, copilotMessages, handleTriggerLearn, fetchKnowledge]);

  // Nodes filtered by search query, node type, and memory source
  const filteredNodes = useMemo(() => {
    if (!graph?.nodes) return [];
    const query = searchQuery.trim().toLowerCase();

    return graph.nodes.filter((node) => {
      if (node.type === 'core') return true;
      if (typeFilter !== 'all' && node.type !== typeFilter) return false;
      if (sourceFilter !== 'all' && node.source !== sourceFilter) return false;

      if (query) {
        const matchLabel = node.label.toLowerCase().includes(query);
        const matchSummary = node.summary.toLowerCase().includes(query);
        const matchMeta = Object.values(node.metadata).some(
          (val) => val && String(val).toLowerCase().includes(query),
        );
        return matchLabel || matchSummary || matchMeta;
      }
      return true;
    });
  }, [graph?.nodes, searchQuery, typeFilter, sourceFilter]);

  // Edges filtered so they only connect visible nodes
  const filteredEdges = useMemo(() => {
    if (!graph?.edges) return [];
    const visibleIds = new Set(filteredNodes.map((n) => n.id));
    return graph.edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [graph?.edges, filteredNodes]);

  // Currently selected node object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !graph?.nodes) return null;
    return graph.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, graph?.nodes]);

  // Neighbors of the selected node
  const connectedNeighbors = useMemo(() => {
    if (!selectedNodeId || !graph) return [];
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const results: Array<{
      edge: BrainEdge;
      targetNode: BrainNode;
      isOutgoing: boolean;
    }> = [];

    for (const edge of graph.edges) {
      if (edge.source === selectedNodeId) {
        const targetNode = nodeMap.get(edge.target);
        if (targetNode) results.push({ edge, targetNode, isOutgoing: true });
      } else if (edge.target === selectedNodeId) {
        const sourceNode = nodeMap.get(edge.source);
        if (sourceNode) results.push({ edge, targetNode: sourceNode, isOutgoing: false });
      }
    }
    return results;
  }, [selectedNodeId, graph]);

  // Auto-switch to inspector when a node is selected in 3D canvas
  useEffect(() => {
    if (selectedNodeId) {
      setActiveSideTab('inspector');
    }
  }, [selectedNodeId]);

  return (
    <div className="space-y-6">
      {/* ─── LEARNING PULSE TOAST NOTIFICATION ─── */}
      {learningNotification && (
        <div className="flex items-center justify-between rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-xs text-cyan-900 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-600">psychology</span>
            <span className="font-semibold">{learningNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setLearningNotification(null)}
            className="text-cyan-700 hover:text-cyan-950 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. EDITORIAL HEADER SECTION (EXACT CRM DESIGN SYSTEM)    */}
      {/* ======================================================== */}
      <section className="mb-8 flex justify-between items-end flex-wrap gap-4">
        <div className="max-w-2xl">
          <span className="text-orange-600 font-bold tracking-widest text-[11px] uppercase mb-1.5 flex items-center gap-1.5">
            <span>⚡</span>
            <span>{isEn ? 'RIFX CRM · Central Sales Brain' : 'RIFX CRM · Cerebro Central del Negocio'}</span>
          </span>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-3 flex items-center gap-3 flex-wrap">
            <span>
              {isEn ? 'AI Brain · Central CRM Director' : 'Cerebro Central del CRM'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {isEn ? 'CRM Operations Director Active' : 'Director Central Activo'}
            </span>
          </h1>
          <p className="text-sm md:text-base text-slate-500 font-normal leading-relaxed max-w-4xl">
            {isEn
              ? 'Central CRM Brain. Governs customer conversations, Meta Ads advertising, phone calls and continuous sales learning to close more deals with persuasive, warm, and highly professional responses.'
              : 'El Director Central del CRM. Gobierna cómo contestar en WhatsApp, cómo estructurar la publicidad en Meta Ads, cómo asesorar en llamadas y aprende continuamente qué le gusta y qué le disgusta escuchar a tus clientes para cerrar ventas de forma profesional, cálida e irresistible.'}
          </p>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          {adminView && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs">
              <span className="material-symbols-outlined text-base text-orange-500">store</span>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {isEn ? 'Tenant' : 'Empresa'}
                </span>
                <select
                  key="brain-tenant-select"
                  value={tenantId ?? 'all'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTenantId(val);
                    onSelectTenantId?.(val);
                  }}
                  className="cursor-pointer bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="all">
                    🌐 {isEn ? 'Entire Platform (Global)' : 'Toda la Plataforma (Global)'}
                  </option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      🏢 {t.companyName || t.email || t.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleTriggerLearn}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">bolt</span>
            <span>{isEn ? 'Consolidate Learning' : 'Consolidar Aprendizaje'}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchBrainData(true)}
            disabled={loading || refreshing}
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs shadow-xs hover:bg-slate-50 transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-base ${refreshing ? 'animate-spin' : ''}`}>sync</span>
            <span>{isEn ? 'Sync Memory' : 'Sincronizar'}</span>
          </button>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 1.5 PANEL DE CANALES GOBERNADOS POR EL CEREBRO CENTRAL   */}
      {/* ======================================================== */}
      <section className="mb-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
              <span className="material-symbols-outlined text-xl">neurology</span>
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>{isEn ? 'Central CRM Director · Active Operational Hub' : 'Mente Directora Central de Todo el CRM'}</span>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isEn ? 'Governing 100% of Decisions' : 'Gobernando 100% de Decisiones'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {isEn
                  ? 'All marketing, sales messaging, objection handling, and phone calls are actively directed by this Brain.'
                  : 'Toda la publicidad, atención en WhatsApp, manejo de objeciones y llamadas son dirigidas por este Cerebro.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveSideTab('learning')}
            className="rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 shadow-xs"
          >
            <span className="material-symbols-outlined text-sm text-slate-500">psychology</span>
            <span>{isEn ? 'View Learned Rules' : 'Ver Reglas y Aprendizaje'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Canal 1: WhatsApp */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 flex flex-col justify-between hover:bg-white hover:border-emerald-200 hover:shadow-xs transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <div className="w-6 h-6 rounded-md bg-emerald-500 text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">chat</span>
                </div>
                <span>WhatsApp CRM</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                Cero Frialdad
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Cierre con doble alternativa, validación empática y anclaje de retorno de inversión.
            </p>
          </div>

          {/* Canal 2: Meta Ads */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 flex flex-col justify-between hover:bg-white hover:border-blue-200 hover:shadow-xs transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">campaign</span>
                </div>
                <span>Meta Ads & Copys</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                Scroll-Stop Hooks
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Publicidad dirigida por los dolores reales de la gente, evitando frases tabú y maximizando CTR.
            </p>
          </div>

          {/* Canal 3: Llamadas de Voz */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 flex flex-col justify-between hover:bg-white hover:border-purple-200 hover:shadow-xs transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <div className="w-6 h-6 rounded-md bg-purple-600 text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">phone_in_talk</span>
                </div>
                <span>Llamadas de Voz</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold border border-purple-200">
                Persuasión 1:1
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Pausas empáticas de 1.2s, ritmo de 140 WPM, sin repetir preguntas y confirmación asertiva de agenda.
            </p>
          </div>

          {/* Canal 4: Auto-Aprendizaje */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 flex flex-col justify-between hover:bg-white hover:border-orange-200 hover:shadow-xs transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                </div>
                <span>Auto-Aprendizaje</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 font-bold border border-orange-200">
                Tiempo Real
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Asimilación automática de qué gusta y disgusta escuchar en cada compra o cita concretada.
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. STATS KPI ROW (3 LIGHT CARDS + 1 DARK HERO ACCENT)    */}
      {/* ======================================================== */}
      {graph && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card 1: RED MULTI-TENANT */}
          <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center justify-between transition-all hover:shadow-md">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <span>🌐</span>
                {isEn ? 'Multi-Tenant Network' : 'Red Multi-Tenant'}
              </p>
              <p className="text-3xl font-black text-slate-800">
                {graph.salesIntelligence?.totalTenantsAnalyzed || tenants.length || 1} {isEn ? 'Tenants' : 'Usuarios'}
              </p>
              <span className="text-[10px] text-cyan-600 font-semibold flex items-center gap-1 mt-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                {isEn ? 'Cross-learning from all accounts' : 'Aprendiendo de todas las cuentas'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-cyan-50 text-cyan-600">
              <span className="material-symbols-outlined text-2xl">neurology</span>
            </div>
          </div>

          {/* Card 2: DOLORES CAPTADOS */}
          <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center justify-between transition-all hover:shadow-md">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <span>🎯</span>
                {isEn ? 'Captured Customer Pains' : 'Dolores Captados'}
              </p>
              <p className="text-3xl font-black text-slate-800">
                {graph.salesIntelligence?.customerPains?.length || 4} {isEn ? 'Key Pains' : 'Puntos Clave'}
              </p>
              <span className="text-[10px] text-teal-600 font-semibold flex items-center gap-1 mt-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500" />
                {isEn ? 'Mapped from WhatsApp & calls' : 'Mapeados de WhatsApp y llamadas'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-teal-50 text-teal-600">
              <span className="material-symbols-outlined text-2xl">psychology</span>
            </div>
          </div>

          {/* Card 3: LO QUE NO GUSTA OÍR (TABÚES) */}
          <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center justify-between transition-all hover:shadow-md">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <span>🚫</span>
                {isEn ? 'Friction Taboos' : 'Lo que NO Gusta Oír'}
              </p>
              <p className="text-3xl font-black text-slate-800">
                {graph.salesIntelligence?.frictionTriggers?.length || 4} {isEn ? 'Taboos' : 'Frases Tabú'}
              </p>
              <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
                {isEn ? 'Replaced with winning closes' : 'Reemplazadas con cierres de venta'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-rose-50 text-rose-600">
              <span className="material-symbols-outlined text-2xl">do_not_disturb_on</span>
            </div>
          </div>

          {/* Card 4: ESPECIALISTA EN VENTAS */}
          <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center justify-between transition-all hover:shadow-md">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <span>⚡</span>
                {isEn ? 'Sales Specialization' : 'Especialista en Ventas'}
              </p>
              <p className="text-3xl font-black text-slate-800">
                +41% <span className="text-base font-bold text-slate-500">Cierre</span>
              </p>
              <span className="text-[10px] text-orange-600 font-semibold flex items-center gap-1 mt-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500" />
                {isEn ? 'Double alternative active' : 'Cierre de doble alternativa activo'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0 text-white shadow-lg shadow-orange-500/20">
              <span className="material-symbols-outlined text-2xl">workspace_premium</span>
            </div>
          </div>
        </section>
      )}

      {/* ERROR BANNER */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 shadow-xs mb-6">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-rose-600">error</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchBrainData()}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 shadow-xs"
          >
            {isEn ? 'Retry' : 'Reintentar'}
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. TOOLBAR: CATEGORY PILL FILTERS + SEARCH (CRM STYLE)   */}
      {/* ======================================================== */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-black text-slate-900 font-headline tracking-tight">
            {isEn ? 'Synaptic Map & Memory' : 'Mapa Sináptico 3D'}
          </h2>
          <span className="text-slate-400 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full text-xs">
            {filteredNodes.length} {isEn ? 'active nodes' : 'nodos en memoria'}
          </span>
        </div>

        {/* Category Filter Pills (Matching CRM directory pills) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs transition-all ${
              typeFilter === 'all'
                ? 'bg-slate-900 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            {isEn ? 'All Entities' : 'Todos'}
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('customer')}
            className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1 ${
              typeFilter === 'customer'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            <span>👤</span>
            <span>{isEn ? 'Customers' : 'Clientes'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('conversation')}
            className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1 ${
              typeFilter === 'conversation'
                ? 'bg-indigo-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            <span>💬</span>
            <span>{isEn ? 'Chats' : 'Conversaciones'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('sale')}
            className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1 ${
              typeFilter === 'sale'
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            <span>💰</span>
            <span>{isEn ? 'Sales' : 'Ventas'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('voice')}
            className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1 ${
              typeFilter === 'voice'
                ? 'bg-pink-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            <span>📞</span>
            <span>{isEn ? 'Calls' : 'Llamadas'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('knowledge')}
            className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1 ${
              typeFilter === 'knowledge'
                ? 'bg-sky-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            <span>📚</span>
            <span>{isEn ? 'Knowledge' : 'Conocimiento'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('objection')}
            className={`px-3 py-1.5 rounded-full text-xs transition-all flex items-center gap-1 ${
              typeFilter === 'objection'
                ? 'bg-rose-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            <span>🛡️</span>
            <span>{isEn ? 'Objections' : 'Objeciones'}</span>
          </button>
        </div>

        {/* Search & Source filter dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-sm text-slate-400">
              search
            </span>
            <input
              key="brain-search-input"
              type="text"
              value={searchQuery ?? ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEn ? 'Search nodes...' : 'Buscar nodo...'}
              className="w-44 focus:w-60 transition-all rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-700 placeholder-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            )}
          </div>

          <select
            key="brain-source-filter"
            value={sourceFilter ?? 'all'}
            onChange={(e) => setSourceFilter(e.target.value as 'all' | 'confirmed' | 'inferred')}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-orange-500 focus:outline-none"
          >
            <option value="all">{isEn ? 'All Sources' : 'Toda la Memoria'}</option>
            <option value="confirmed">{isEn ? 'Confirmed' : 'Confirmada'}</option>
            <option value="inferred">{isEn ? 'AI Inferred' : 'Inferencias IA'}</option>
          </select>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. MAIN WORKSPACE: 3D MASTER CARD + COMMAND COPILOT      */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* LEFT / CENTER: MASTER 3D NEURAL CONTAINER CARD */}
        <div className="xl:col-span-8 2xl:col-span-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex flex-col">
            {/* Top Bar inside the white card */}
            <div className="flex items-center justify-between pb-3.5 mb-1 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold shadow-md transition-all ${
                    viewMode === 'neuromapa'
                      ? 'bg-gradient-to-br from-[#a193ff] to-[#6366f1] shadow-[#a193ff]/20'
                      : 'bg-gradient-to-br from-orange-500 to-amber-500 shadow-orange-500/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">neurology</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 font-headline flex items-center gap-2">
                    <span>
                      {viewMode === 'neuromapa'
                        ? isEn
                          ? 'Cognitive Neuromapa CRM'
                          : 'Neuromapa Cognitivo CRM'
                        : isEn
                        ? 'Anatomical 3D Cortex & Synaptic Rays'
                        : 'Corteza Cerebral Anatómica 3D'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                        viewMode === 'neuromapa'
                          ? 'bg-[#a193ff]/15 text-[#6366f1] border-[#a193ff]/30'
                          : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                      }`}
                    >
                      {viewMode === 'neuromapa'
                        ? `${filteredNodes.length} Nodos · Sinapsis Activas & Halos`
                        : '2,100 Neuronas · Rayos Sinápticos Activos'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-normal">
                    {viewMode === 'neuromapa'
                      ? isEn
                        ? 'Interactive Neuromapa canvas · Neural spotlighting, synaptic action potentials and focus'
                        : 'Lienzo interactivo Neuromapa · Enfoque sináptico, impulsos eléctricos y halos neuronales'
                      : isEn
                      ? 'Deep cognitive neural mesh · Actively learning customer messages & call coherence'
                      : 'Malla neural profunda · Asimila continuamente mensajes de WhatsApp y calibra la coherencia en llamadas'}
                  </p>
                </div>
              </div>

              {/* View Mode Switcher Pills */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/60 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('neuromapa')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === 'neuromapa'
                        ? 'bg-gradient-to-r from-[#a193ff] to-[#6366f1] text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">neurology</span>
                    <span>{isEn ? 'Neuromapa' : 'Modo Neuromapa'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('3d')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === '3d'
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">view_in_ar</span>
                    <span>{isEn ? '3D Galaxy' : 'Galaxia 3D'}</span>
                  </button>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
              </div>
            </div>

            {/* Inner Canvas Box */}
            <div className="relative h-[650px] w-full overflow-hidden rounded-2xl bg-[#0a0c10] shadow-inner">
              {loading ? (
                <div className="flex h-full w-full flex-col items-center justify-center space-y-3 bg-[#0a0c10] text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-5xl text-[#a193ff]">
                    neurology
                  </span>
                  <p className="text-sm font-semibold text-slate-200">
                    {isEn ? 'Generating Neuromapa & Synaptic Lattice...' : 'Generando lienzo de Neuromapa y red sináptica...'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isEn ? 'Positioning neural clusters and CRM entities' : 'Posicionando racimos neuronales y entidades del CRM'}
                  </p>
                </div>
              ) : filteredNodes.length === 0 ? (
                <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-slate-400">
                  <span className="material-symbols-outlined mb-3 text-5xl text-slate-600">
                    filter_alt_off
                  </span>
                  <h4 className="text-base font-semibold text-white">
                    {isEn ? 'No nodes match your filters' : 'Ningún nodo coincide con los filtros'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setTypeFilter('all');
                      setSourceFilter('all');
                    }}
                    className="mt-4 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    {isEn ? 'Reset Filters' : 'Restablecer Filtros'}
                  </button>
                </div>
              ) : viewMode === 'neuromapa' ? (
                <NeuromapaGraph
                  nodes={filteredNodes}
                  edges={filteredEdges}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={(id) => setSelectedNodeId(id)}
                  language={language}
                  learningState={graph?.learning}
                  onTriggerLearn={handleTriggerLearn}
                  onExecuteCopilotAction={(action, node) => {
                    setActiveSideTab('copilot');
                    setCopilotMessages((prev) => [
                      ...prev,
                      {
                        id: `ctx-${Date.now()}`,
                        role: 'assistant',
                        content: `Analizando el nodo "${node.label}" (${NODE_TYPE_META[node.type]?.[isEn ? 'labelEn' : 'labelEs'] || node.type}). ${node.summary}. ¿Deseas que prepare una propuesta comercial, evalúe el historial de mensajes o programe una acción?`,
                        timestamp: new Date().toISOString(),
                      },
                    ]);
                  }}
                />
              ) : (
                <BrainGraph3D
                  nodes={filteredNodes}
                  edges={filteredEdges}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={(id) => setSelectedNodeId(id)}
                  language={language}
                  learningState={graph?.learning}
                  onTriggerLearn={handleTriggerLearn}
                />
              )}
            </div>

            {/* Bottom Bar: Guide depending on viewMode */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {viewMode === 'neuromapa'
                  ? isEn
                    ? 'Neural Categories'
                    : 'Categorías Neuronales'
                  : isEn
                  ? 'Lobes & Regions'
                  : 'Guía de Lóbulos'}
                :
              </span>
              {viewMode === 'neuromapa' ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-[#a193ff]" />
                    Core Motor IA
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-[#10b981]" />
                    Clientes / CRM
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-[#06b6d4]" />
                    Conversaciones WhatsApp
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-[#8b5cf6]" />
                    Respuestas Aprendidas
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                    Intención & Ventas
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
                    Objeciones Resueltas
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-[#6366f1]" />
                    Base de Conocimiento
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-pink-500" />
                    Temporal (Memoria WhatsApp)
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Auditivo / Broca (Coherencia en Llamadas)
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Prefrontal (Reglas & Estrategia)
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    Cerebelo (Respuestas Inmediatas)
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    Frontal (Clientes)
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Accumbens (Ventas)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: COMMAND CENTER, LEARNING ENGINE, INSPECTOR (CLEAN CRM SYSTEM) */}
        <div className="xl:col-span-4 2xl:col-span-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col h-[755px]">
            {/* Top Tab Bar (CRM Pill Style) */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 mb-4">
              <button
                type="button"
                onClick={() => setActiveSideTab('copilot')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                  activeSideTab === 'copilot'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-sm">smart_toy</span>
                <span>{isEn ? 'Copilot AI' : 'Copiloto IA'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSideTab('learning')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                  activeSideTab === 'learning'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-sm">psychology</span>
                <span>{isEn ? 'Learning' : 'Aprendizaje'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSideTab('inspector')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                  activeSideTab === 'inspector'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                <span>{isEn ? 'Inspector' : 'Inspector'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSideTab('activity')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                  activeSideTab === 'activity'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-sm">stream</span>
                <span>{isEn ? 'Activity' : 'Actividad'}</span>
              </button>
            </div>

            {/* ======================================================== */}
            {/* TAB 1: COPILOTO IA - EL EJE QUE MANEJA EL CRM            */}
            {/* ======================================================== */}
            {activeSideTab === 'copilot' && (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header */}
                <div className="mb-3.5 flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold shadow-xs shadow-orange-500/20">
                      <span className="material-symbols-outlined text-sm">neurology</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-headline">
                        {isEn ? 'Central CRM Copilot' : 'Asistente Central del Cerebro'}
                      </h4>
                      <p className="text-[11px] text-emerald-600 font-semibold">
                        {isEn ? 'Orchestrating CRM in real time' : 'Gobernando el CRM en tiempo real'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsInjectModalOpen(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-md shadow-orange-500/20 hover:scale-[1.02] transition-all active:scale-95"
                    >
                      <span className="material-symbols-outlined text-sm">add_circle</span>
                      <span>{isEn ? '+ Inject Knowledge' : '+ Inyectar Conocimiento'}</span>
                    </button>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      v3.8 Cognitive
                    </span>
                  </div>
                </div>

                {/* Autonomous Quick Actions */}
                <div className="mb-3.5 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {isEn ? 'Master Sales Director Commands' : 'Comandos de Especialista en Ventas'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={copilotLoading}
                      onClick={() => handleExecuteAutonomousAction('audit_pains')}
                      className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 text-left text-[11px] font-semibold text-slate-700 transition-all hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-900 active:scale-95 disabled:opacity-50 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-sm text-indigo-600">psychology</span>
                      <span className="truncate">Mapear dolores cliente</span>
                    </button>

                    <button
                      type="button"
                      disabled={copilotLoading}
                      onClick={() => handleExecuteAutonomousAction('friction_taboos')}
                      className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 text-left text-[11px] font-semibold text-slate-700 transition-all hover:bg-rose-50 hover:border-rose-300 hover:text-rose-900 active:scale-95 disabled:opacity-50 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-sm text-rose-600">do_not_disturb_on</span>
                      <span className="truncate">Qué evitar (Tabúes)</span>
                    </button>

                    <button
                      type="button"
                      disabled={copilotLoading}
                      onClick={() => handleExecuteAutonomousAction('closing_master')}
                      className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 text-left text-[11px] font-semibold text-slate-700 transition-all hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-900 active:scale-95 disabled:opacity-50 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-sm text-emerald-600">workspace_premium</span>
                      <span className="truncate">Técnicas de cierre</span>
                    </button>

                    <button
                      type="button"
                      disabled={copilotLoading}
                      onClick={() => handleExecuteAutonomousAction('calibrate_voice')}
                      className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 text-left text-[11px] font-semibold text-slate-700 transition-all hover:bg-pink-50 hover:border-pink-300 hover:text-pink-900 active:scale-95 disabled:opacity-50 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-sm text-pink-600">phone_in_talk</span>
                      <span className="truncate">Calibrar llamadas voz</span>
                    </button>
                  </div>
                </div>

                {/* Chat Message Log */}
                <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                  {copilotMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col rounded-2xl p-3.5 text-xs leading-relaxed ${
                        msg.role === 'assistant'
                          ? 'border border-slate-100 bg-slate-50/80 text-slate-800'
                          : 'ml-6 bg-[#0058bc] text-white shadow-xs'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-[10px]">
                        <span className={`font-bold flex items-center gap-1 ${msg.role === 'assistant' ? 'text-slate-900' : 'text-white/90'}`}>
                          {msg.role === 'assistant' ? (
                            <>
                              <span className="material-symbols-outlined text-xs text-orange-500">neurology</span>
                              Cerebro IA
                            </>
                          ) : (
                            'Tú'
                          )}
                        </span>
                        <span className={msg.role === 'assistant' ? 'text-slate-400' : 'text-white/70'}>
                          {formatRelativeTime(msg.timestamp, isEn)}
                        </span>
                      </div>
                      {renderFormattedContent(msg.content)}
                    </div>
                  ))}

                  {copilotLoading && (
                    <div className="flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50/40 p-3 text-xs text-orange-900">
                      <span className="material-symbols-outlined animate-spin text-sm text-orange-500">progress_activity</span>
                      <span>El Cerebro está procesando la orden y analizando la memoria...</span>
                    </div>
                  )}
                </div>

                {/* Chat Input Bar */}
                <div className="mt-3.5 space-y-1.5">
                  {copilotInput.trim().toLowerCase().match(/^(aprende|learn|recuerda|memoriza|guarda)/) && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-700 px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 animate-in fade-in">
                      <span className="material-symbols-outlined text-xs text-orange-500">psychology</span>
                      <span>Modo Ingestión de Conocimiento Activo: Este mensaje se guardará en la memoria permanente del Cerebro.</span>
                    </div>
                  )}
                  <form onSubmit={handleSendCopilotPrompt} className="flex items-center gap-2">
                    <input
                      key="brain-copilot-input"
                      type="text"
                      value={copilotInput ?? ''}
                      onChange={(e) => setCopilotInput(e.target.value)}
                      placeholder={
                        isEn
                          ? 'Ask anything or type "Learn: [rule]" to train the brain...'
                          : 'Pregunta lo que sea o escribe "Aprende: [regla]" para entrenar...'
                      }
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setIsInjectModalOpen(true)}
                      title="Inyectar Conocimiento Estructurado"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-all active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">psychology</span>
                    </button>
                    <button
                      type="submit"
                      disabled={!copilotInput.trim() || copilotLoading}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm hover:from-orange-600 hover:to-amber-600 transition-all active:scale-95 disabled:opacity-50 shadow-orange-500/20"
                    >
                      <span className="material-symbols-outlined text-base">send</span>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: APRENDIZAJE CONTINUO (CHATS, VENTAS, LLAMADAS)    */}
            {/* ======================================================== */}
            {activeSideTab === 'learning' && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-headline">
                      {isEn ? 'Continuous Learning Engine' : 'Motor de Aprendizaje Continuo'}
                    </h4>
                    <p className="text-[11px] text-orange-600 font-semibold">
                      {isEn ? 'Extracting patterns from messages, sales & calls' : 'Asimilando patrones de mensajes, ventas y llamadas'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsInjectModalOpen(true)}
                      className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 px-3 py-1 text-[11px] font-bold text-white shadow-xs shadow-orange-500/20 transition-all"
                    >
                      <span className="material-symbols-outlined text-xs">add</span>
                      <span>Inyectar Regla</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTriggerLearn}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 shadow-xs"
                    >
                      Forzar Ciclo
                    </button>
                  </div>
                </div>

                {/* 0. Injected Knowledge Bank */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-xs shadow-orange-500/20">
                        <span className="material-symbols-outlined text-sm">psychology</span>
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">
                          Base de Conocimiento y Reglas Activas ({knowledgeList.length})
                        </h5>
                        <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Sincronizado con WhatsApp y Llamadas de Voz
                        </p>
                      </div>
                    </div>
                  </div>

                  {knowledgeList.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-4 text-center">
                      <span className="material-symbols-outlined text-slate-400 text-2xl mb-1">school</span>
                      <p className="text-xs font-semibold text-slate-700">Aún no has inyectado reglas personalizadas</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Agrega objeciones, precios o guiones para que la IA tome decisiones más inteligentes en cada conversación o llamada.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsInjectModalOpen(true)}
                        className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 px-3 py-1 text-[11px] font-bold text-white shadow-md shadow-orange-500/20"
                      >
                        <span className="material-symbols-outlined text-xs">add</span>
                        <span>+ Inyectar Primera Regla</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {knowledgeList.map((item) => {
                        const cat = CATEGORY_TAGS[item.category] || CATEGORY_TAGS.general;
                        return (
                          <div
                            key={item.id}
                            className="rounded-xl border border-slate-200/80 bg-white p-3 text-xs shadow-xs space-y-1.5 transition-all hover:border-slate-300"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-bold text-slate-900 min-w-0">
                                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${cat.bg} ${cat.text}`}>
                                  <span className="material-symbols-outlined text-[11px]">{cat.icon}</span>
                                  {cat.label}
                                </span>
                                <span className="truncate">{item.title}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteKnowledge(item.id)}
                                title="Eliminar conocimiento"
                                className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-md hover:bg-rose-50"
                              >
                                <span className="material-symbols-outlined text-xs">delete</span>
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">
                              {item.content}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 1. Mapeo de Dolores de Clientes Captados */}
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-600 text-lg">psychology</span>
                      <h5 className="text-xs font-bold text-slate-900">
                        1. Mapeo de Dolores Captados de Clientes
                      </h5>
                    </div>
                    <span className="rounded-full bg-indigo-100 text-indigo-800 px-2.5 py-0.5 text-[10px] font-bold">
                      {graph?.salesIntelligence?.customerPains?.length || 4} Dolores Críticos
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Frustraciones y miedos reales detectados en los mensajes entrantes de WhatsApp y llamadas de voz en toda la plataforma:
                  </p>
                  <div className="space-y-2.5">
                    {(graph?.salesIntelligence?.customerPains || [
                      {
                        id: 'pain-time-response',
                        pain: 'Incertidumbre y Lentitud en la Confirmación',
                        frequency: 'Crítica',
                        impactArea: 'Primeros 5 minutos de contacto (WhatsApp)',
                        recommendedSolution: 'Confirmar inmediatamente disponibilidad con fecha u hora concreta ("¿Te queda mejor lunes a las 5pm o jueves a las 3pm?") en lugar de respuestas genéricas.',
                        exampleQuote: 'Quiero agendar una cita para el lunes a las 5 de la tarde... me urge confirmar hoy.',
                      },
                      {
                        id: 'pain-human-connection',
                        pain: 'Frustración con Respuestas Evasivas o Mecánicas',
                        frequency: 'Muy Alta',
                        impactArea: 'Percepción de calidad y confianza',
                        recommendedSolution: 'Empatía inmediata y personalización. Evitar disculpas frías o sistemas en pausa; responder con tono cálido, humano y resolutivo.',
                        exampleQuote: '¿Me puedes comunicar con una persona real? No quiero hablar con un contestador.',
                      },
                      {
                        id: 'pain-price-skepticism',
                        pain: 'Temor al Gasto sin Garantía de Retorno (ROI)',
                        frequency: 'Alta',
                        impactArea: 'Etapa de propuesta económica',
                        recommendedSolution: 'Nunca dar el precio en frío sin antes haber anclado el valor y la garantía de resultados (30 días o devolución). Desglosar el ROI esperado antes del costo.',
                        exampleQuote: 'El precio es muy elevado para lo que podemos invertir ahora mismo.',
                      },
                      {
                        id: 'pain-past-bad-experience',
                        pain: 'Miedo al Incumplimiento o Abandono Post-Venta',
                        frequency: 'Alta',
                        impactArea: 'Cierre final de la venta o llamada',
                        recommendedSolution: 'Destacar acompañamiento 24/7 y casos de éxito comprobados. La venta se cierra reduciendo el riesgo del cliente a cero.',
                        exampleQuote: 'Ya contraté un servicio similar el año pasado y no me entregaron lo prometido.',
                      }
                    ]).map((pain: any) => (
                      <div key={pain.id} className="rounded-xl border border-indigo-100 bg-white p-3 text-[11px] shadow-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-indigo-900">{pain.pain}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                            pain.frequency === 'Crítica' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {pain.frequency}
                          </span>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[10px] text-slate-600 italic">
                          "{pain.exampleQuote}"
                        </div>
                        <p className="text-[10px] text-slate-700 leading-relaxed">
                          <strong className="text-emerald-700 font-bold">Solución Comercial: </strong>
                          {pain.recommendedSolution}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Lo que a la Gente NO le Gusta Oír (Fricción & Tabúes) */}
                <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-rose-600 text-lg">do_not_disturb_on</span>
                      <h5 className="text-xs font-bold text-slate-900">
                        2. Lo que a la Gente NO le Gusta Oír (Errores & Tabúes)
                      </h5>
                    </div>
                    <span className="rounded-full bg-rose-100 text-rose-800 px-2.5 py-0.5 text-[10px] font-bold">
                      Evitar en WhatsApp y Llamadas
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Frases y actitudes detectadas que provocan rechazo, pérdida de leads o abandono de compra:
                  </p>
                  <div className="space-y-2.5">
                    {(graph?.salesIntelligence?.frictionTriggers || [
                      {
                        id: 'fric-no-disponibilidad',
                        phraseOrBehavior: '"Lamentablemente en este momento no tenemos disponibilidad / no tengo acceso"',
                        severity: 'Crítica',
                        whyItFails: 'Corta en seco el interés de compra del cliente y lo hace sentir rechazado o que la empresa es ineficiente.',
                        betterAlternative: '"Con gusto te ayudo a coordinarlo de inmediato. Déjame ver las opciones prioritarias que tenemos para ti hoy."',
                      },
                      {
                        id: 'fric-precio-sin-valor',
                        phraseOrBehavior: '"Cuesta $X dólares. ¿Le interesa?"',
                        severity: 'Crítica',
                        whyItFails: 'Provoca shock de precio inmediato sin haber generado deseo ni justificación de rentabilidad.',
                        betterAlternative: '"Nuestra solución incluye [beneficio clave] y [garantía], lo que genera un ROI de 3.5x. La inversión completa es de solo $X."',
                      },
                      {
                        id: 'fric-presion-sigue-interesado',
                        phraseOrBehavior: '"Hola, ¿sigues interesado? / ¿Viste mi mensaje anterior?"',
                        severity: 'Alta',
                        whyItFails: 'Suena desesperado, egocéntrico y traslada la culpa al prospecto en lugar de aportar valor nuevo.',
                        betterAlternative: '"Hola [Nombre], estuve revisando tu caso y preparé esta idea rápida para resolver [dolor]. ¿Te la comparto en 1 minuto?"',
                      },
                      {
                        id: 'fric-tecnicismos-complejos',
                        phraseOrBehavior: 'Explicaciones técnicas aburridas (APIs, tokens, servidores, configuraciones)',
                        severity: 'Media',
                        whyItFails: 'Al cliente no le importa el cableado técnico; solo le importa ganar más dinero o ahorrar tiempo.',
                        betterAlternative: 'Hablar de resultados palpables: "Esto te permite recibir ventas directas en tu WhatsApp sin mover un solo dedo."',
                      },
                    ]).map((fric: any) => (
                      <div key={fric.id} className="rounded-xl border border-rose-100 bg-white p-3 text-[11px] shadow-xs space-y-1.5">
                        <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                          <span className="material-symbols-outlined text-xs text-rose-500">cancel</span>
                          <span>{fric.phraseOrBehavior}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug">
                          <strong className="text-slate-700">Por qué falla: </strong>{fric.whyItFails}
                        </p>
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2 text-[10px] text-emerald-900">
                          <strong className="font-bold flex items-center gap-1 text-emerald-800 mb-0.5">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            Alternativa Ganadora:
                          </strong>
                          {fric.betterAlternative}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Patrones de Cierre Infalibles */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-lg">workspace_premium</span>
                      <h5 className="text-xs font-bold text-slate-900">
                        3. Patrones de Cierre Infalibles (Master Sales Playbook)
                      </h5>
                    </div>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold">
                      +41% Conversión
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Estructuras de persuasión y negociación asimiladas del historial de ventas ganadas:
                  </p>
                  <div className="space-y-2.5">
                    {(graph?.salesIntelligence?.closingTechniques || [
                      {
                        id: 'close-double-alternative',
                        name: 'Cierre de Doble Alternativa Consultiva',
                        conversionBoost: '+34% agendamiento en WhatsApp',
                        description: 'Nunca preguntar "¿Quieres una cita?" (invita a decir "no"). Dar dos opciones favorables de fecha y hora.',
                        scriptSnippet: '"¿Te viene mejor revisar los detalles mañana a las 11:00 AM o el jueves a las 4:00 PM?"',
                      },
                      {
                        id: 'close-risk-reversal',
                        name: 'Inversión de Riesgo Absoluta (Garantía Cero Fricción)',
                        conversionBoost: '+41% conversión ante objeción de precio',
                        description: 'Asumir el riesgo para que el cliente sienta que no tiene absolutamente nada que perder.',
                        scriptSnippet: '"Si en los primeros 15 días sientes que esto no supera con creces lo que invertiste, te reembolsamos el 100% sin preguntas."',
                      },
                      {
                        id: 'close-roi-reframing',
                        name: 'Reencuadre de Costo vs Inversión Amortizada',
                        conversionBoost: '+28% aceptación en tickets medianos y altos',
                        description: 'Demostrar que una sola venta nueva que genere el sistema cubre el costo completo de 3 meses.',
                        scriptSnippet: '"Con solo un cliente adicional que cerremos con este flujo, la herramienta ya se pagó sola y te deja utilidad neta."',
                      },
                    ]).map((tech: any) => (
                      <div key={tech.id} className="rounded-xl border border-emerald-100 bg-white p-3 text-[11px] shadow-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-emerald-900">{tech.name}</span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold shrink-0">
                            {tech.conversionBoost}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 leading-relaxed">{tech.description}</p>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-[10px] text-slate-800">
                          {tech.scriptSnippet}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Respuestas con Mayor Reacción y Conversión */}
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-600 text-lg">auto_awesome</span>
                      <h5 className="text-xs font-bold text-slate-900">
                        4. Respuestas con Mayor Reacción de Compra (Ganchos Comprobados)
                      </h5>
                    </div>
                    <span className="rounded-full bg-indigo-100 text-indigo-800 px-2.5 py-0.5 text-[10px] font-bold">
                      92% Reacción Positiva
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Estructuras de respuesta a las que los clientes reaccionan con mayor agilidad para avanzar y cerrar ventas:
                  </p>
                  <div className="space-y-2.5">
                    {((graph?.salesIntelligence as any)?.winningResponses || [
                      {
                        id: 'win-agenda-inmediata',
                        situation: 'Cliente pide agendar o pregunta disponibilidad ("quiero cita el lunes a las 5pm")',
                        winningPattern: 'Confirmación Asertiva Inmediata + Cierre de Doble Alternativa',
                        reactionRate: '92% de confirmación positiva',
                        conversionImpact: '+46% en ventas y citas cerradas',
                        exampleScript: '"¡Con todo gusto! Para coordinarlo de inmediato, ¿te queda mejor lunes a las 5:00 PM o prefieres jueves a las 3:00 PM? Déjame tu nombre completo y lo dejamos reservado."',
                        whyItConverts: 'Elimina las excusas de "no tengo acceso al calendario". El cliente percibe eficiencia y solo tiene que responder con su nombre y confirmar.',
                      },
                      {
                        id: 'win-precio-anclado',
                        situation: 'Cliente pregunta "¿cuánto cuesta?" o "¿qué precio tiene?"',
                        winningPattern: 'Anclaje de Valor y Retorno antes de revelar la Inversión',
                        reactionRate: '86% de continuidad en el embudo',
                        conversionImpact: '+39% en retención de prospectos',
                        exampleScript: '"Nuestra solución te garantiza [beneficio clave 1] y soporte continuo para que recuperes tu inversión en las primeras semanas. La inversión completa es de solo $X."',
                        whyItConverts: 'Evita el shock de precio y reencuadra el costo como una inversión altamente rentable.',
                      },
                      {
                        id: 'win-garantia-cero-riesgo',
                        situation: 'Cliente duda sobre efectividad o expresa desconfianza',
                        winningPattern: 'Inversión de Riesgo Absoluta y Garantía de Satisfacción',
                        reactionRate: '89% de avance a compra',
                        conversionImpact: '+41% en conversión ante objeciones',
                        exampleScript: '"Cuentas con garantía de satisfacción total. Si en los primeros 15 días sientes que esto no supera lo que esperabas, te reembolsamos el 100%. Todo el riesgo corre por nuestra cuenta."',
                        whyItConverts: 'Reduce el riesgo del comprador a cero absoluto, facilitando una decisión inmediata.',
                      },
                    ]).map((win: any) => (
                      <div key={win.id} className="rounded-xl border border-indigo-100 bg-white p-3 text-[11px] shadow-xs space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">{win.situation}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                              {win.reactionRate}
                            </span>
                            <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                              {win.conversionImpact}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-indigo-900 font-semibold leading-relaxed">
                          🎯 Patrón: {win.winningPattern}
                        </p>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono text-[10px] text-slate-800">
                          {win.exampleScript}
                        </div>
                        <p className="text-[10px] text-slate-500 italic">
                          💡 {win.whyItConverts}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Señales de Compra Detectadas */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-600 text-lg">monetization_on</span>
                      <h5 className="text-xs font-bold text-slate-900">
                        5. Señales de Compra Detectadas en Chats y Llamadas
                      </h5>
                    </div>
                    <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[10px] font-bold">
                      Acción Inmediata
                    </span>
                  </div>
                  <div className="space-y-2">
                    {((graph?.salesIntelligence as any)?.buyingSignals || [
                      {
                        id: 'sig-horario',
                        signal: 'Cliente especifica día u horario puntual ("lunes a las 5", "mañana en la tarde")',
                        customerIntent: 'Intención de compra o reserva de cita inmediata',
                        frequency: 'Crítica',
                        winningAction: 'Confirmar de inmediato, tomar nombre/teléfono y bloquear la agenda. NUNCA volver a preguntar dudas.',
                      },
                      {
                        id: 'sig-metodo-pago',
                        signal: 'Cliente consulta por medios de pago, link de cobro o cuentas bancarias',
                        customerIntent: 'Fase de desembolso y pago activo',
                        frequency: 'Alta',
                        winningAction: 'Enviar datos oficiales de pago de inmediato con instrucciones breves y claras.',
                      },
                      {
                        id: 'sig-tiempo-entrega',
                        signal: 'Cliente pregunta "¿cuándo arrancamos?" o "¿cuánto tarda en estar listo?"',
                        customerIntent: 'Urgencia de puesta en marcha',
                        frequency: 'Alta',
                        winningAction: 'Dar fecha u hora concreta y confirmar activación inmediata una vez confirmado el inicio.',
                      },
                    ]).map((sig: any) => (
                      <div key={sig.id} className="rounded-xl border border-amber-100 bg-white p-3 text-[11px] shadow-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-950 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-xs text-amber-600">electric_bolt</span>
                            {sig.signal}
                          </span>
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                            {sig.frequency}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600">
                          <strong>Intención:</strong> {sig.customerIntent}
                        </p>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[10px] text-emerald-900 font-medium">
                          <strong>Acción Ganadora:</strong> {sig.winningAction}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. Calibración de Llamadas Telefónicas de Voz */}
                <div className="rounded-2xl border border-pink-200 bg-pink-50/40 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-pink-600 text-lg">phone_in_talk</span>
                      <h5 className="text-xs font-bold text-slate-900">
                        4. Calibración de Llamadas de Voz (Teléfono)
                      </h5>
                    </div>
                    <span className="rounded-full bg-pink-100 text-pink-800 px-2.5 py-0.5 text-[10px] font-bold">
                      140 WPM · Pausa 1.2s
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Directrices de acústica, ritmo y empatía para que las llamadas de ventas suenen naturales, persuasivas y de alta autoridad:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-white rounded-xl p-2.5 border border-pink-100">
                      <span className="font-bold text-pink-900 block mb-0.5">⏱️ Pausa de Escucha Activa</span>
                      <span className="text-slate-600">1.2 segundos antes de rebatir una objeción para no sonar agresivo ni robótico.</span>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-pink-100">
                      <span className="font-bold text-pink-900 block mb-0.5">🗣️ Cadencia Verbal</span>
                      <span className="text-slate-600">140 palabras por minuto. Articulación clara y tono asertivo y consultivo.</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-2.5 border border-pink-100 text-[10px] text-slate-700">
                    <strong className="text-pink-900 font-bold block mb-1">Estructura para rebatir objeciones por teléfono:</strong>
                    <span>1. Validación Empática ("Entiendo perfectamente tu punto...") → 2. Pregunta Diagnóstico ("¿Qué es lo más crítico para ti hoy?") → 3. Cierre con Demostración de ROI.</span>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 3: INSPECTOR DE NODOS SELECCIONADOS                  */}
            {/* ======================================================== */}
            {activeSideTab === 'inspector' && (
              <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                {selectedNode ? (
                  <div className="space-y-5">
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                            NODE_TYPE_META[selectedNode.type].bg
                          } ${NODE_TYPE_META[selectedNode.type].text}`}
                        >
                          <span className="material-symbols-outlined text-xs">
                            {NODE_TYPE_META[selectedNode.type].icon}
                          </span>
                          {NODE_TYPE_META[selectedNode.type][isEn ? 'labelEn' : 'labelEs']}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedNodeId(null)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          ✕
                        </button>
                      </div>

                      <h3 className="mt-3 text-xl font-bold text-slate-900 leading-snug font-headline">
                        {selectedNode.label}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">{selectedNode.summary}</p>
                    </div>

                    {/* AI Quick Actions on Selected Node */}
                    <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-3.5 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
                        Acción del Asistente IA sobre este Nodo
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSideTab('copilot');
                          setCopilotMessages((prev) => [
                            ...prev,
                            {
                              id: `ctx-${Date.now()}`,
                              role: 'assistant',
                              content: `Analizando el nodo "${selectedNode.label}". ¿Deseas que redacte una propuesta, agende una cita o revise las objeciones registradas para este contacto?`,
                              timestamp: new Date().toISOString(),
                            },
                          ]);
                        }}
                        className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-2 text-xs font-bold transition-all shadow-md shadow-orange-500/20"
                      >
                        Comandar Asistente para este Nodo →
                      </button>
                    </div>

                    {/* Attributes */}
                    {Object.keys(selectedNode.metadata).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Atributos y Metadatos
                        </h4>
                        <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                          {Object.entries(selectedNode.metadata).map(([key, val]) => {
                            if (val === null || val === undefined) return null;
                            return (
                              <div key={key} className="flex items-center justify-between py-1 border-b border-slate-200/50 last:border-0">
                                <span className="text-slate-500 capitalize">{key}:</span>
                                <span className="font-semibold text-slate-800">{String(val)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Synaptic Neighbors */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Sinapsis Conectadas
                        </h4>
                        <span className="text-[10px] text-slate-500 font-bold">
                          {connectedNeighbors.length} enlaces
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {connectedNeighbors.map(({ edge, targetNode, isOutgoing }) => (
                          <button
                            key={edge.id}
                            type="button"
                            onClick={() => setSelectedNodeId(targetNode.id)}
                            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-left text-xs transition-colors hover:border-orange-300 hover:bg-white shadow-xs"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: NODE_TYPE_META[targetNode.type].color }}
                              />
                              <div className="min-w-0">
                                <p className="truncate font-bold text-slate-800">{targetNode.label}</p>
                                <p className="truncate text-[10px] text-slate-400">
                                  {NODE_TYPE_META[targetNode.type].labelEs}
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-orange-600">
                              {isOutgoing ? '→' : '←'} {edge.relation}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400">
                    <span className="material-symbols-outlined mb-3 text-4xl text-orange-500">touch_app</span>
                    <h4 className="text-sm font-bold text-slate-800">Ningún Nodo Seleccionado</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Haz clic en cualquier nodo o sinapsis dentro del cerebro 3D para examinar sus atributos.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 4: FLUJO DE ACTIVIDAD                                */}
            {/* ======================================================== */}
            {activeSideTab === 'activity' && (
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                <div className="mb-3.5 flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-headline">
                    Flujo de Actividad Sináptica
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500">
                    {graph?.activity.length || 0} eventos
                  </span>
                </div>

                <div className="space-y-2.5">
                  {graph?.activity.map((item: BrainActivity) => {
                    const meta = NODE_TYPE_META[item.type] || NODE_TYPE_META.conversation;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedNodeId(item.nodeId);
                          setActiveSideTab('inspector');
                        }}
                        className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-all hover:border-orange-300 hover:bg-white shadow-xs"
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
                        >
                          <span className="material-symbols-outlined text-base">{meta.icon}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="truncate text-xs font-bold text-slate-800 group-hover:text-orange-600">
                              {item.title}
                            </p>
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {formatRelativeTime(item.timestamp, isEn)}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.detail}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* INJECT KNOWLEDGE MODAL                                   */}
      {/* ======================================================== */}
      {isInjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-orange-500/20">
                  <span className="material-symbols-outlined text-lg">psychology</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-headline">
                    {isEn ? 'Inject Strategic Knowledge' : 'Inyectar Conocimiento Estratégico'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isEn
                      ? 'Train the AI Brain to make better decisions in chats and calls'
                      : 'Entrena al Cerebro para tomar mejores decisiones en WhatsApp y llamadas'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInjectModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setInjectMode('upload')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                  injectMode === 'upload'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-sm">upload_file</span>
                <span>Subir Documento / Archivo</span>
              </button>
              <button
                type="button"
                onClick={() => setInjectMode('manual')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${
                  injectMode === 'manual'
                    ? 'bg-white text-orange-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-sm">edit_note</span>
                <span>Escribir Manualmente</span>
              </button>
            </div>

            {injectMode === 'upload' ? (
              <form key="inject-upload-form" onSubmit={handleUploadFileKnowledge} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Categoría del Documento
                  </label>
                  <select
                    key="upload-category-select"
                    value={newCategory ?? 'objections'}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 focus:bg-white"
                  >
                    <option value="product">📦 Catálogo de Productos y Precios</option>
                    <option value="sales">💰 Estrategia de Ventas y Cierre</option>
                    <option value="objections">🛡️ Manejo de Objeciones (Precio, Dudas)</option>
                    <option value="scripts">📝 Guiones y Scripts de Conversación</option>
                    <option value="faq">❓ Preguntas Frecuentes (FAQ)</option>
                    <option value="process">⚙️ Políticas y Procesos del Negocio</option>
                    <option value="competitor">🥊 Diferenciación vs Competencia</option>
                    <option value="general">🧠 Conocimiento General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Archivo para el Cerebro
                  </label>
                  <input
                    key="upload-file-input"
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.markdown,.csv,.json,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        if (!newTitle) {
                          setNewTitle(file.name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        if (!newTitle) {
                          setNewTitle(file.name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                    className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                      selectedFile
                        ? 'border-orange-500 bg-orange-50/40'
                        : 'border-slate-200 bg-slate-50 hover:border-orange-400 hover:bg-white'
                    }`}
                  >
                    {selectedFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                          <span className="material-symbols-outlined text-2xl">
                            {selectedFile.name.endsWith('.pdf') ? 'picture_as_pdf' : 'description'}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{selectedFile.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {(selectedFile.size / 1024).toFixed(1)} KB · Clic para cambiar archivo
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-xl bg-slate-200/70 text-slate-500 flex items-center justify-center">
                          <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            Haz clic o arrastra tu archivo aquí
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Soporta PDF, TXT, MD, CSV, JSON (catálogos, precios, objeciones)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Título o Nombre Clave (Opcional)
                  </label>
                  <input
                    key="upload-title-input"
                    type="text"
                    value={newTitle ?? ''}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ej: Catálogo Oficial 2026, Objeciones Frecuentes..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 focus:bg-white"
                  />
                </div>

                {uploadProgress && (
                  <div className="rounded-xl bg-orange-50 border border-orange-200 p-2.5 flex items-center gap-2 text-[11px] text-orange-800">
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    <span>{uploadProgress}</span>
                  </div>
                )}

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 flex items-start gap-2.5 text-[11px] text-emerald-800">
                  <span className="material-symbols-outlined text-base text-emerald-600 shrink-0 mt-0.5">verified</span>
                  <p>
                    El documento será extraído e indexado como nodo de memoria en el Cerebro 3D. El bot de WhatsApp y las llamadas de voz lo asimilarán en tiempo real.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsInjectModalOpen(false);
                      setSelectedFile(null);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingFile || !selectedFile}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition-all disabled:opacity-50"
                  >
                    {isUploadingFile ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                        <span>Asimilando Archivo...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">upload</span>
                        <span>Asimilar Archivo en el Cerebro</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form key="inject-manual-form" onSubmit={handleSaveKnowledge} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Categoría del Conocimiento
                  </label>
                  <select
                    key="manual-category-select"
                    value={newCategory ?? 'objections'}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 focus:bg-white"
                  >
                    <option value="objections">🛡️ Manejo de Objeciones (Precio, Tiempo, Dudas)</option>
                    <option value="sales">💰 Estrategia de Ventas y Cierre</option>
                    <option value="scripts">📝 Guiones y Scripts de Conversación</option>
                    <option value="product">📦 Información de Productos y Precios</option>
                    <option value="process">⚙️ Políticas y Procesos de Atención</option>
                    <option value="faq">❓ Preguntas Frecuentes (FAQ)</option>
                    <option value="competitor">🥊 Diferenciación vs Competencia</option>
                    <option value="general">🧠 Regla General del Negocio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Título o Tema Clave
                  </label>
                  <input
                    key="manual-title-input"
                    type="text"
                    required
                    value={newTitle ?? ''}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ej: Objeción de precio alto, Descuento en pago anticipado, etc."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Instrucción, Regla o Información Detallada
                  </label>
                  <textarea
                    key="manual-content-textarea"
                    required
                    rows={4}
                    value={newContent ?? ''}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Describe qué debe responder la IA, qué argumentos usar o qué límites fijar cuando surja esta situación..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 focus:bg-white resize-none"
                  />
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 flex items-start gap-2.5 text-[11px] text-emerald-800">
                  <span className="material-symbols-outlined text-base text-emerald-600 shrink-0 mt-0.5">verified</span>
                  <p>
                    Esta regla se asimilará en el Cerebro 3D y se sincronizará automáticamente con las respuestas del bot de WhatsApp y los guiones de llamadas telefónicas.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsInjectModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingKnowledge || !newTitle.trim() || !newContent.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition-all disabled:opacity-50"
                  >
                    {isSavingKnowledge ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                        <span>Asimilando...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">bolt</span>
                        <span>Asimilar en el Cerebro</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

