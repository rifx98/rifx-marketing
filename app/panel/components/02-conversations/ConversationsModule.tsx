'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { Advisor, ConversationDetail, ConversationSummary } from '../00-shared/types';
import { Avatar, EmptyState, Tag } from '../00-shared/ui';
import styles from './conversations.module.css';

// Lead classification helper
function getLeadClassification(score: number) {
  if (score >= 70) {
    return { emoji: '🔥', text: 'Caliente', color: 'text-red-700 bg-red-50 border border-red-200/60' };
  }
  if (score >= 40) {
    return { emoji: '⚡', text: 'Tibio', color: 'text-amber-700 bg-amber-50 border border-amber-200/60' };
  }
  return { emoji: '○', text: 'Frío', color: 'text-slate-600 bg-slate-50 border border-slate-200/60' };
}

// Sales stage label helper
function formatSalesStage(stage?: string): string {
  if (!stage) return 'Nuevo Lead';
  const mapping: Record<string, string> = {
    'new_lead': 'Nuevo Lead',
    'discovery': 'Descubrimiento',
    'qualified': 'Calificado',
    'proposal': 'Propuesta',
    'objection': 'Objeción',
    'closing': 'Cierre',
    'appointment_booked': 'Cita Agendada',
    'won': 'Ganado',
    'lost': 'Perdido',
  };
  return mapping[stage] || stage.replace(/_/g, ' ');
}

// Intent label helper
function formatIntent(intent?: string): string {
  if (!intent) return 'Soporte Técnico';
  const mapping: Record<string, string> = {
    'sales_services': 'Venta Servicios',
    'sales_dropshipping': 'Venta Dropshipping',
    'faq_pricing': 'Pregunta Precios',
    'human_request': 'Solicita Humano',
    'support': 'Soporte Técnico',
    'general_chat': 'Consulta General',
    'ambiguous': 'Consulta General',
  };
  return mapping[intent] || intent.replace(/_/g, ' ');
}

// Format first contact date (e.g. "11 jun 2026")
function formatFirstContactDate(dateStr?: string): string {
  if (!dateStr) return '11 jun 2026';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '11 jun 2026';
  }
}

// Calculate contact age in days
function calculateAgeDays(dateStr?: string): number {
  if (!dateStr) return 89;
  try {
    const days = Math.ceil((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 1;
  } catch {
    return 89;
  }
}

export function ConversationsModule({
  conversations,
  selected,
  advisors,
  onSelect,
  onSearch,
  onStatusFilter,
  onSend,
  onToggleBot,
  onToggleClosed,
  onAssign,
  onEditContact,
  onUpdateContact,
}: {
  conversations: ConversationSummary[];
  selected?: ConversationDetail | null;
  advisors: Advisor[];
  onSelect?: (phone: string) => void;
  onSearch?: (q: string) => void;
  onStatusFilter?: (status: string) => void;
  onSend?: (text: string) => void;
  onToggleBot?: () => void;
  onToggleClosed?: () => void;
  onAssign?: (advisorId: string | null) => void;
  onEditContact?: () => void;
  onUpdateContact?: (updates: {
    name?: string;
    phone_number?: string;
    sales_stage?: string;
    notes?: string;
    tags?: string[];
    assigned_to?: string | null;
  }) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number>(0);
  const prevConvIdRef = useRef<string | null>(null);

  const scrollToBottom = (smooth = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  };

  useEffect(() => {
    if (!selected?.id) return;
    const isNewConv = selected.id !== prevConvIdRef.current;
    const msgCount = selected.messages?.length || 0;
    const hasNewMsgs = msgCount !== prevMsgCountRef.current;

    if (isNewConv) {
      scrollToBottom(false);
      const timer = setTimeout(() => scrollToBottom(false), 60);
      prevConvIdRef.current = selected.id;
      prevMsgCountRef.current = msgCount;
      return () => clearTimeout(timer);
    } else if (hasNewMsgs) {
      scrollToBottom(true);
      const timer = setTimeout(() => scrollToBottom(true), 60);
      prevMsgCountRef.current = msgCount;
      return () => clearTimeout(timer);
    }
  }, [selected?.id, selected?.messages?.length]);

  useEffect(() => {
    if (selected?.botPaused) {
      inputRef.current?.focus();
    }
  }, [selected?.botPaused, selected?.id]);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStage, setEditStage] = useState('new_lead');
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const name = selected?.contact?.name || selected?.name || selected?.phone || 'Usuario';
  const phone = selected?.contact?.phone || selected?.phone || '';
  const rawConv = selected?.rawConv || {};

  // Resolved CRM values
  const leadScore = selected?.lead_score !== undefined && selected?.lead_score !== null 
    ? selected.lead_score 
    : (rawConv.lead_score ?? 16);
  const salesStage = selected?.sales_stage || rawConv.sales_stage || 'new_lead';
  const intent = selected?.intent || rawConv.intent || 'support';
  const urgency = selected?.urgency_level || rawConv.urgency_level || 'unknown';
  const budget = selected?.budget_range || rawConv.budget_range || 'No especificado';
  const serviceInterest = selected?.service_interest || rawConv.service_interest || 'Ninguno';
  const lastObjection = selected?.last_objection || rawConv.last_objection || null;
  const nextAction = selected?.next_action || rawConv.next_action || 'Continuar conversación';
  const createdAt = selected?.created_at || rawConv.created_at;
  const status = selected?.status || rawConv.status || 'chatting';

  const classification = useMemo(() => getLeadClassification(leadScore), [leadScore]);
  const firstContact = useMemo(() => formatFirstContactDate(createdAt), [createdAt]);
  const ageDays = useMemo(() => calculateAgeDays(createdAt), [createdAt]);
  const messagesCount = selected?.messages?.length || (rawConv.messages?.length ?? 0);

  // Contact initials
  const initials = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return 'RM';
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }, [name]);

  const send = () => {
    if (!selected?.botPaused) return;
    const value = draft.trim();
    if (!value) return;
    onSend?.(value);
    setDraft('');
  };

  const copyPhoneToClipboard = () => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openEditModal = () => {
    setEditName(name);
    setEditPhone(phone);
    setEditStage(salesStage);
    setEditNotes(selected?.contact?.notes || rawConv.notes || '');
    setEditTags((selected?.contact?.tags || rawConv.tags || []).join(', '));
    setIsEditingModalOpen(true);
  };

  const handleSaveContact = async () => {
    setIsSaving(true);
    try {
      const tagsArray = editTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      if (onUpdateContact) {
        await onUpdateContact({
          name: editName.trim(),
          phone_number: editPhone.trim(),
          sales_stage: editStage,
          notes: editNotes.trim(),
          tags: tagsArray,
        });
      }
      setIsEditingModalOpen(false);
    } catch (err) {
      console.error('Error saving contact:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const cleanDigits = phone.replace(/[^0-9]/g, '');

  return (
    <div className={styles.grid}>
      {/* ─── LEFT PANEL (Chat List) ─── */}
      <aside className={styles.listPanel}>
        <div className={styles.search}>
          <input
            placeholder="Buscar cliente o mensaje..."
            onChange={(e) => onSearch?.(e.target.value)}
          />
          <select onChange={(e) => onStatusFilter?.(e.target.value)}>
            <option value="">Todas</option>
            <option value="open">Abiertas</option>
            <option value="closed">Cerradas</option>
            <option value="chatting">En Chat</option>
            <option value="interested">Interesados</option>
            <option value="bought">Compraron</option>
          </select>
        </div>
        <div className={styles.list}>
          {conversations.length ? (
            conversations.map((c) => {
              const isSelected = selected?.id && c.id 
                ? selected.id === c.id 
                : selected?.phone === c.phone;
              return (
                <button
                  key={c.id || c.phone}
                  className={`${styles.row} ${isSelected ? styles.active : ''}`}
                  onClick={() => onSelect?.(c.id || c.phone)}
                >
                  <Avatar name={c.name || c.phone} />
                  <span className={styles.rowMain}>
                    <span>
                      <strong>{c.name || c.phone}</strong>
                      <time>{c.lastMessageAt || ''}</time>
                    </span>
                    <small>{c.lastMessage || 'Sin mensajes'}</small>
                    <em>
                      {c.botPaused ? '👤 Humano' : '🤖 Bot'}
                      {c.advisorName ? ` · ${c.advisorName}` : ''}
                      {c.whatsappAccountName ? ` · ${c.whatsappAccountName}` : ''}
                    </em>
                  </span>
                  {c.unread ? <b className={styles.unread}>{c.unread}</b> : null}
                </button>
              );
            })
          ) : (
            <EmptyState icon="📭" title="Sin conversaciones" text="Las conversaciones entrantes aparecerán aquí." />
          )}
        </div>
      </aside>

      {/* ─── CENTER CHAT PANEL ─── */}
      <section className={styles.chat}>
        {!selected ? (
          <EmptyState
            icon="💬"
            title="Selecciona una conversación"
            text="Desde aquí puedes responder manualmente y pausar o reactivar el bot."
          />
        ) : (
          <>
            <header className={styles.chatHeader}>
              <div className={styles.person}>
                <Avatar name={name} />
                <div>
                  <strong>{name}</strong>
                  <small>
                    {selected.phone} · {selected.botPaused ? '👤 Atención humana (Tú tienes el control)' : '🤖 Bot activo (Chat bloqueado)'}
                  </small>
                </div>
              </div>
              <div className={styles.headerActions}>
                <button 
                  onClick={onToggleBot}
                  className={selected.botPaused ? styles.btnGiveBotControl : styles.btnTakeControl}
                  title={selected.botPaused ? "Devolver el control automático al bot" : "Pausar el bot y responder manualmente"}
                >
                  {selected.botPaused ? '🤖 Dar control al bot' : '👤 Tomar el control'}
                </button>
                <button className={styles.ghost} onClick={onToggleClosed}>
                  {selected.status === 'closed' || selected.status === 'bought' ? 'Reabrir' : 'Cerrar'}
                </button>
              </div>
            </header>

            <div ref={messagesContainerRef} className={styles.messages}>
              {selected.messages.length ? (
                selected.messages.map((m, i) => (
                  <div
                    key={m.id || i}
                    className={`${styles.bubble} ${
                      m.direction === 'in' ? styles.in : m.direction === 'out' ? styles.out : styles.system
                    }`}
                  >
                    {m.media?.url && (
                      <div className={styles.media}>
                        📎 {m.media.filename || m.media.type || 'archivo'}
                      </div>
                    )}
                    {m.text && <div>{m.text}</div>}
                    <small>
                      {m.createdAt || ''}
                      {m.status ? ` · ${m.status}` : ''}
                    </small>
                  </div>
                ))
              ) : (
                <EmptyState title="Sin mensajes todavía" />
              )}
            </div>

            {/* Control Bar Banner */}
            {!selected.botPaused ? (
              <div className={styles.botControlBar}>
                <div className={styles.botControlBarText}>
                  <span className={styles.botControlBarBadge}>🤖 Bot activo</span>
                  <span>El asistente IA está respondiendo automáticamente. El chat está bloqueado.</span>
                </div>
                <button 
                  type="button" 
                  className={styles.btnTakeControlCompact} 
                  onClick={onToggleBot}
                  title="Pausar el bot para escribir manualmente"
                >
                  👤 Tomar el control
                </button>
              </div>
            ) : (
              <div className={styles.humanControlBar}>
                <div className={styles.humanControlBarText}>
                  <span className={styles.humanControlBarBadge}>👤 Control humano</span>
                  <span>Tienes el control manual del chat. El bot no responderá a este cliente.</span>
                </div>
                <button 
                  type="button" 
                  className={styles.btnGiveBotControlCompact} 
                  onClick={onToggleBot}
                  title="Devolver las respuestas automáticas a la IA"
                >
                  🤖 Dar control al bot
                </button>
              </div>
            )}

            <div className={`${styles.compose} ${!selected.botPaused ? styles.composeLocked : ''}`}>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && selected.botPaused) send();
                }}
                disabled={!selected.botPaused}
                className={!selected.botPaused ? styles.inputDisabled : ''}
                placeholder={
                  selected.botPaused
                    ? "Escribe un mensaje como asesor humano..."
                    : "🔒 Chat bloqueado — Toma el control para poder escribir"
                }
              />
              <button 
                onClick={send} 
                disabled={!selected.botPaused || !draft.trim()}
                className={!selected.botPaused || !draft.trim() ? styles.btnSendDisabled : ''}
              >
                Enviar
              </button>
            </div>
          </>
        )}
      </section>

      {/* ─── RIGHT SIDEBAR (INTELIGENCIA CRM COMERCIAL — CAPTURA 2) ─── */}
      <aside className={styles.info}>
        {!selected ? (
          <EmptyState icon="👤" title="Información del contacto" text="Selecciona una conversación para ver los detalles." />
        ) : (
          <div className="flex flex-col bg-slate-50 min-h-full pb-8">
            {/* 1. Header Banner with Gradient & Circles */}
            <div className="relative h-20 bg-gradient-to-br from-[#000080] via-[#00003c] to-[#000080]/80 overflow-hidden shrink-0">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-2 right-4 w-20 h-20 border border-white/30 rounded-full" />
                <div className="absolute bottom-0 left-8 w-32 h-32 border border-white/20 rounded-full -mb-16" />
              </div>
              {/* Status Badge Top Right */}
              <div className="absolute top-3 right-3">
                <span
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest backdrop-blur-sm shadow-sm ${
                    status === 'interested'
                      ? 'bg-emerald-500/95 text-white'
                      : status === 'bought'
                      ? 'bg-emerald-600/95 text-white'
                      : 'bg-amber-500/95 text-white'
                  }`}
                >
                  {status === 'interested' ? 'Interesado' : status === 'bought' ? 'Compró' : 'EN CHAT'}
                </span>
              </div>
            </div>

            {/* 2. Avatar + Name below banner */}
            <div className="px-6 -mt-8 relative z-10 flex flex-col items-center text-center">
              <div className="relative mb-2.5">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-[#00003c] font-black text-xl shadow-xl border-4 border-white">
                  {initials}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-lg shadow-md flex items-center justify-center">
                  <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                </div>
              </div>
              <h3 className="text-base font-extrabold text-[#00003c] truncate max-w-full m-0">{name}</h3>
              <p className="text-xs text-slate-400 font-mono font-bold mt-0.5 m-0">{phone}</p>
            </div>

            {/* 3. Quick Stats Row (3 Metrics) */}
            <div className="px-5 pt-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-xl p-3 text-center border border-slate-100 shadow-sm">
                  <p className="text-lg font-black text-[#00003c] m-0">{messagesCount}</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 m-0 mt-0.5">Mensajes</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center border border-slate-100 shadow-sm">
                  <p className="text-lg font-black text-emerald-500 m-0">{leadScore}%</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 m-0 mt-0.5">Puntaje</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center border border-slate-100 shadow-sm">
                  <p className="text-lg font-black text-amber-500 m-0">{ageDays}d</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400 m-0 mt-0.5">Antigüedad</p>
                </div>
              </div>
            </div>

            {/* 4. Contact Details Card */}
            <div className="px-5 pt-3">
              <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50 shadow-sm overflow-hidden">
                {/* Phone + Copy button */}
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="material-symbols-outlined text-slate-400 text-base">phone</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 m-0">Teléfono</p>
                    <p className="text-xs font-bold text-slate-700 truncate m-0">{phone || 'N/A'}</p>
                  </div>
                  <button
                    onClick={copyPhoneToClipboard}
                    className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                    title={copied ? '¡Copiado!' : 'Copiar teléfono'}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {copied ? 'check' : 'content_copy'}
                    </span>
                  </button>
                </div>
                {/* First Contact Date */}
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="material-symbols-outlined text-slate-400 text-base">calendar_today</span>
                  <div className="flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 m-0">Primer Contacto</p>
                    <p className="text-xs font-bold text-slate-700 m-0">{firstContact}</p>
                  </div>
                </div>
                {/* Channel WhatsApp */}
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="material-symbols-outlined text-slate-400 text-base">hub</span>
                  <div className="flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 m-0">Canal</p>
                    <p className="text-xs font-bold text-slate-700 m-0">WhatsApp</p>
                  </div>
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                </div>
              </div>
            </div>

            {/* 5. INTELIGENCIA CRM COMERCIAL */}
            <div className="px-5 pt-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                INTELIGENCIA CRM COMERCIAL
              </p>
              <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3.5 shadow-sm">
                {/* Score de Lead & Clasificación */}
                <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 m-0">Score de Lead</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-lg font-black text-slate-700">{leadScore}</span>
                      <span className="text-xs text-slate-400">/ 100</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 m-0">Clasificación</p>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 mt-1 ${classification.color}`}
                    >
                      <span>{classification.emoji}</span>
                      <span>{classification.text}</span>
                    </span>
                  </div>
                </div>

                {/* Etapa de Venta & Intención IA */}
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-50">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 m-0">Etapa de Venta</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded border border-slate-200 text-slate-600 bg-slate-50 text-[10px] font-semibold capitalize">
                      {formatSalesStage(salesStage)}
                    </span>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 m-0">Intención IA</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded border border-indigo-100 text-indigo-600 bg-indigo-50/50 text-[10px] font-semibold capitalize font-sans">
                      {formatIntent(intent)}
                    </span>
                  </div>
                </div>

                {/* Urgencia & Presupuesto */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 m-0">Urgencia</p>
                    <p className="font-semibold text-slate-700 mt-0.5 m-0 text-xs">{urgency}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 m-0">Presupuesto</p>
                    <p className="font-semibold text-slate-700 mt-0.5 m-0 text-xs">{budget}</p>
                  </div>
                </div>

                {/* Servicio de Interés */}
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 m-0">Servicio de Interés</p>
                  <p className="font-semibold text-slate-700 mt-0.5 m-0 text-xs">{serviceInterest}</p>
                </div>

                {/* Última Objeción */}
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 m-0">Última Objeción</p>
                  <div className="mt-1 bg-red-50/60 border border-red-100/50 rounded-lg p-2.5">
                    <p className="text-xs font-semibold text-red-700 italic m-0">
                      {lastObjection ? `"${lastObjection}"` : 'Ninguna objeción'}
                    </p>
                  </div>
                </div>

                {/* Próxima Acción */}
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 m-0">Próxima Acción</p>
                  <div className="mt-1 bg-amber-50/70 border border-amber-100/60 rounded-lg p-2.5">
                    <p className="text-xs font-semibold text-amber-800 m-0">
                      {nextAction}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. ACTIVIDAD RECIENTE */}
            <div className="px-5 pt-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2.5">
                ACTIVIDAD RECIENTE
              </p>
              <div className="space-y-0">
                <div className="flex gap-3 relative pb-3.5">
                  <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-slate-200" />
                  <div className="w-6 h-6 min-w-[24px] rounded-full bg-[#000080] flex items-center justify-center text-white z-10 shrink-0">
                    <span className="material-symbols-outlined text-[12px]">mail</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 m-0">Mensaje Recibido</p>
                    <p className="text-[10px] text-slate-400 truncate m-0">"Interacción activa detectada..."</p>
                    <span className="text-[9px] text-slate-300">Hoy</span>
                  </div>
                </div>

                <div className="flex gap-3 relative pb-3.5">
                  <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-slate-200" />
                  <div className="w-6 h-6 min-w-[24px] rounded-full bg-amber-400 flex items-center justify-center text-white z-10 shrink-0">
                    <span className="material-symbols-outlined text-[12px]">label</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 m-0">Segmento Actualizado</p>
                    <p className="text-[10px] text-slate-400 truncate m-0">Status · {status || 'Activo'}</p>
                    <span className="text-[9px] text-slate-300">{firstContact}</span>
                  </div>
                </div>

                <div className="flex gap-3 relative">
                  <div className="w-6 h-6 min-w-[24px] rounded-full bg-slate-200 flex items-center justify-center text-slate-500 z-10 shrink-0">
                    <span className="material-symbols-outlined text-[12px]">smart_toy</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 m-0">IA Clasificado</p>
                    <p className="text-[10px] text-slate-400 truncate m-0">Auto-categorizado por motor neuronal</p>
                    <span className="text-[9px] text-slate-300">{firstContact}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 7. Asignado a selector (Functional) */}
            <div className="px-5 pt-4">
              <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 m-0">
                  Asignado a
                </p>
                <select
                  value={selected.assignedTo || 'bot'}
                  onChange={(e) => onAssign?.(e.target.value || null)}
                  className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-[#000080]"
                >
                  <option value="bot">Bot Principal · Activo</option>
                  {advisors.filter(a => a.id !== 'bot').map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.status || 'Disponible'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 8. Quick Actions & Edit Contact Button */}
            <div className="px-5 pt-3 space-y-2">
              <div className="flex gap-2">
                {cleanDigits && (
                  <a
                    href={`https://wa.me/${cleanDigits}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 bg-[#25d366] hover:bg-[#20bd5a] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all text-decoration-none"
                  >
                    <span className="material-symbols-outlined text-sm">chat</span>
                    WhatsApp
                  </a>
                )}
                {cleanDigits && (
                  <a
                    href={`tel:+${cleanDigits}`}
                    className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center transition-all text-decoration-none"
                    title="Llamar"
                  >
                    <span className="material-symbols-outlined text-sm text-blue-600">call</span>
                  </a>
                )}
              </div>

              {/* Botón Editar Contacto (Functional) */}
              <button
                onClick={openEditModal}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-[#d32f2f] text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Editar contacto
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ─── MODAL EDITAR CONTACTO (Functional) ─── */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#000080]">person_edit</span>
                <h3 className="font-extrabold text-[#00003c] text-base m-0">Editar Contacto</h3>
              </div>
              <button
                onClick={() => setIsEditingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#000080] focus:ring-1 focus:ring-[#000080]"
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#000080] focus:ring-1 focus:ring-[#000080]"
                  placeholder="Ej. 593983910712"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Etapa de Venta (CRM)
                </label>
                <select
                  value={editStage}
                  onChange={(e) => setEditStage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#000080] focus:ring-1 focus:ring-[#000080]"
                >
                  <option value="new_lead">Nuevo Lead</option>
                  <option value="discovery">Descubrimiento</option>
                  <option value="qualified">Calificado</option>
                  <option value="proposal">Propuesta</option>
                  <option value="objection">Objeción</option>
                  <option value="closing">Cierre</option>
                  <option value="appointment_booked">Cita Agendada</option>
                  <option value="won">Ganado</option>
                  <option value="lost">Perdido</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Notas Internas
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#000080] focus:ring-1 focus:ring-[#000080]"
                  placeholder="Escribe detalles relevantes sobre este cliente..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Etiquetas (separadas por coma)
                </label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#000080] focus:ring-1 focus:ring-[#000080]"
                  placeholder="vip, interesado, ecommerce"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveContact}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold bg-[#000080] hover:bg-[#00006e] text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">save</span>
                )}
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
