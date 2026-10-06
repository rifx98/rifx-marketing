'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  prepareOutreachTemplate,
  renderAgencyReply,
  renderOutreach,
  SAMPLE_OUTREACH,
  validOutreachEmail,
  parseBulkRecipientList,
  personalizeProposal,
  type OutreachDraft,
  type ParsedBulkRecipient,
} from '@/lib/outreach';

type Contact = OutreachDraft & {
  id: string;
  delivery_status: 'draft' | 'sending' | 'sent' | 'uncertain';
  stage: string;
  suppressed: boolean;
  sent_at: string | null;
};

export type BulkResultItem = {
  email: string;
  business: string;
  status: 'sent' | 'failed' | 'skipped' | 'pending';
  messageId?: string;
  error?: string;
};

const stages = {
  pending: 'Pendiente',
  replied: 'Respondió',
  meeting: 'Reunión agendada',
  won: 'Contratado / Ganado',
  declined: 'No contactar',
};

const delivery = {
  draft: 'Borrador',
  sending: 'Enviando...',
  sent: 'Aceptado por el servidor',
  uncertain: 'Revisar estado de envío',
};

const emptyDraft: OutreachDraft = {
  business: '',
  email: '',
  subject: '',
  observation: '',
  proposal: '',
  price: 'USD 300',
  service_title: 'Gestión de anuncios publicitarios',
  deliverables: '12 piezas gráficas • 3 videos editables',
  deliverables_note: 'La inversión en anuncios se paga por separado.',
  image_url: '',
  template_html: null,
  include_whatsapp: true,
  whatsapp_phone: '+593 98 391 0712',
};

const AI_EXAMPLES = [
  {
    title: 'Comercio / Ventas (Redes, imágenes y videos)',
    text: 'Escribe un mensaje de marketing a este comercial ofreciéndole un servicio donde puedo gestionar sus redes para aumentar sus ventas y que su negocio sea más visible para las personas. El paquete incluye 12 imágenes de post y 3 videos que se editan (los videos los envían ellos y pagan su inversión publicitaria por separado).',
  },
  {
    title: 'Servicios Profesionales (Captación de clientes)',
    text: 'Redacta una propuesta de marketing digital orientada a captar clientes potenciales calificados a través de campañas segmentadas en Meta Ads, canalizando las consultas directamente hacia su WhatsApp para cotizaciones inmediatas.',
  },
  {
    title: 'Gastronomía / Restaurantes (Afluencia local)',
    text: 'Propuesta comercial para potenciar la visibilidad de su restaurante o local gastronómico los fines de semana mediante videos cortos dinámicos, promociones llamativas y anuncios geolocalizados a clientes cercanos.',
  },
];

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 transition-all';

type QuickReplyItem = {
  id: string;
  title: string;
  text: string;
  isDefault?: boolean;
};

const DEFAULT_QUICK_REPLIES: QuickReplyItem[] = [
  {
    id: 'pedir-whatsapp',
    title: '📲 Pedir WhatsApp',
    text: 'Hola {{nombre}},\n\nCon mucho gusto. ¿Me indicas a qué número de WhatsApp puedo escribirte para coordinar los detalles y enviarte ejemplos?\n\nQuedo atento.',
    isDefault: true,
  },
  {
    id: 'proponer-llamada',
    title: '📅 Proponer llamada',
    text: 'Hola {{nombre}},\n\nPerfecto. ¿Te parece bien si coordinamos una breve videollamada de 10 minutos para revisar los detalles del paquete?\n\n¿Qué día y hora te queda más cómodo?',
    isDefault: true,
  },
  {
    id: 'confirmar-inicio',
    title: '🚀 Confirmar inicio',
    text: 'Hola {{nombre}},\n\nExcelente. El paquete acordado incluye 12 piezas gráficas y 3 videos editables con pauta segmentada. ¿Deseas que iniciemos esta semana con la primera propuesta de diseño?\n\nQuedo a tu disposición.',
    isDefault: true,
  },
];

type SentReplyItem = {
  id: string;
  threadKey: string;
  text: string;
  subject: string;
  date: string;
  includeWhatsApp?: boolean;
};

export type InboxThread = {
  threadId: string;
  clientEmail: string;
  clientName: string;
  matchedContactBusiness?: string;
  matchedContactId?: string;
  latestSubject: string;
  latestSnippet: string;
  latestDate: string;
  messages: Array<{
    uid: string;
    fromEmail: string;
    fromName: string;
    subject: string;
    date: string;
    snippet: string;
    matchedContactId?: string;
    matchedContactBusiness?: string;
  }>;
  uids: string[];
  isStarred: boolean;
};

function WhatsAppIcon({ className = 'h-4 w-4', fill = '#25D366' }: { className?: string; fill?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 1.892.525 3.662 1.438 5.176L2.1 21.9l4.87-1.306A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm5.408 14.123c-.226.634-1.127 1.189-1.83 1.342-.48.104-1.107.188-3.218-.687-2.699-1.118-4.437-3.856-4.571-4.035-.134-.179-1.09-1.453-1.09-2.771 0-1.318.69-1.966.935-2.234.246-.268.536-.335.715-.335.179 0 .357.001.513.009.167.008.39-.063.61.464.227.545.77 1.876.837 2.01.067.135.112.291.022.47-.089.178-.134.29-.268.446-.134.156-.282.348-.402.468-.134.134-.274.28-.118.548.156.267.693 1.144 1.488 1.851 1.023.91 1.884 1.192 2.152 1.326.268.134.424.112.58-.067.157-.179.67-.782.848-1.05.179-.268.358-.223.603-.134.246.09 1.563.737 1.831.871.268.134.446.201.513.313.067.111.067.647-.159 1.281z"
        fill={fill}
      />
    </svg>
  );
}

type EmailTemplate = { id: string; name: string; html: string };

function formatInboxDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      const parts = dateStr.split(' ');
      return parts.slice(0, 3).join(' ') || dateStr;
    }
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const isThisYear = d.getFullYear() === now.getFullYear();
    if (isThisYear) {
      return `${day} ${month}`;
    }
    return `${day} ${month} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export default function OutreachClient({ embedded = false }: { embedded?: boolean }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateCode, setTemplateCode] = useState('');
  const [draft, setDraft] = useState<OutreachDraft>(SAMPLE_OUTREACH);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [ready, setReady] = useState(false);
  const [smtpReady, setSmtpReady] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sender, setSender] = useState('bryanarcos@rifx-marketing.com');
  const [message, setMessage] = useState('Cargando módulo de correos...');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [query, setQuery] = useState('');
  const [showContactList, setShowContactList] = useState(false);
  const [previewSize, setPreviewSize] = useState<'mobile' | 'desktop'>('desktop');

  // Estado del Asistente de Escritura AI
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStyle, setAiStyle] = useState('Profesional');
  const [aiLanguage, setAiLanguage] = useState('Spanish (Español)');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<{
    subject?: string;
    observation?: string;
    proposal?: string;
    service_title?: string;
    price?: string;
    deliverables?: string;
    deliverables_note?: string;
    full_draft?: string;
  } | null>(null);
  const [aiFeedback, setAiFeedback] = useState<'up' | 'down' | null>(null);
  const [aiDropdownOpen, setAiDropdownOpen] = useState(false);

  // Estado para subida de fotos desde galería
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Pestaña principal: Editor individual vs Envíos Masivos vs Bandeja de Respuestas
  const [activeTab, setActiveTab] = useState<'editor' | 'bulk' | 'inbox'>('editor');

  // Estado para Envíos Masivos (Campaña)
  const [bulkMode, setBulkMode] = useState<'crm' | 'paste'>('crm');
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [bulkFilterStatus, setBulkFilterStatus] = useState<'all' | 'draft' | 'pending' | 'sent'>('all');
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkPastedText, setBulkPastedText] = useState('');
  const [bulkParsedRecipients, setBulkParsedRecipients] = useState<ParsedBulkRecipient[]>([]);
  const [bulkInvalidLines, setBulkInvalidLines] = useState<string[]>([]);
  const [bulkDuplicatesCount, setBulkDuplicatesCount] = useState(0);
  const [bulkSaveToCrm, setBulkSaveToCrm] = useState(true);
  const [bulkDelayMs, setBulkDelayMs] = useState(1500);
  const [bulkCampaignDraft, setBulkCampaignDraft] = useState<OutreachDraft>({
    ...SAMPLE_OUTREACH,
    subject: 'Propuesta de marketing digital para {{negocio}}',
    proposal: 'Hola {{negocio}},\n\nAnalizamos su presencia digital y vemos un gran potencial para impulsar sus ventas. Les proponemos una campaña publicitaria integral con pauta segmentada y piezas visuales de alto impacto diseñadas para captar clientes calificados y dirigirlos directamente a su WhatsApp.',
    observation: 'Estrategia comercial para potenciar la visibilidad y captación de clientes de {{negocio}}.',
    price: 'USD 300',
    service_title: 'Gestión de anuncios publicitarios',
    deliverables: '12 piezas gráficas • 3 videos editables',
    deliverables_note: 'La inversión en anuncios se paga por separado.',
    include_whatsapp: true,
    whatsapp_phone: '+593 98 391 0712',
  });
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, sent: 0, failed: 0 });
  const [bulkResults, setBulkResults] = useState<BulkResultItem[]>([]);
  const bulkStopRef = useRef(false);
  const [bulkRightTab, setBulkRightTab] = useState<'preview' | 'monitor'>('preview');
  const [bulkPreviewIndex, setBulkPreviewIndex] = useState(0);
  const [bulkFilterDropdownOpen, setBulkFilterDropdownOpen] = useState(false);
  const bulkFilterDropdownRef = useRef<HTMLDivElement>(null);

  const [inboxDropdownOpen, setInboxDropdownOpen] = useState(false);
  const inboxDropdownRef = useRef<HTMLDivElement>(null);

  const [contactSelectDropdownOpen, setContactSelectDropdownOpen] = useState(false);
  const [contactSelectSearch, setContactSelectSearch] = useState('');
  const contactSelectDropdownRef = useRef<HTMLDivElement>(null);

  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  const stageDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (bulkFilterDropdownRef.current && !bulkFilterDropdownRef.current.contains(target)) {
        setBulkFilterDropdownOpen(false);
      }
      if (inboxDropdownRef.current && !inboxDropdownRef.current.contains(target)) {
        setInboxDropdownOpen(false);
      }
      if (contactSelectDropdownRef.current && !contactSelectDropdownRef.current.contains(target)) {
        setContactSelectDropdownOpen(false);
      }
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(target)) {
        setTemplateDropdownOpen(false);
      }
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(target)) {
        setStageDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  const [inboxMessages, setInboxMessages] = useState<Array<{
    uid: string;
    fromEmail: string;
    fromName: string;
    subject: string;
    date: string;
    snippet: string;
    matchedContactId?: string;
    matchedContactBusiness?: string;
  }>>([]);
  const [syncingInbox, setSyncingInbox] = useState(false);
  const [inboxQuery, setInboxQuery] = useState('');
  const [selectedInboxUid, setSelectedInboxUid] = useState<string | null>(null);
  const [inboxCategoryFilter, setInboxCategoryFilter] = useState<'all' | 'crm' | 'starred'>('all');
  const [inboxSearch, setInboxSearch] = useState('');
  const [starredUids, setStarredUids] = useState<string[]>([]);
  const [selectedInboxUids, setSelectedInboxUids] = useState<string[]>([]);
  const [inboxReplyText, setInboxReplyText] = useState('');
  const [inboxReplySubject, setInboxReplySubject] = useState('');
  const [sendingInboxReply, setSendingInboxReply] = useState(false);
  const [inboxRightTab, setInboxRightTab] = useState<'all' | 'preview' | 'client'>('all');
  const [inboxPreviewSize, setInboxPreviewSize] = useState<'desktop' | 'mobile'>('desktop');
  const [deletingInbox, setDeletingInbox] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    uids: string[];
    description: string;
  } | null>(null);

  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>(DEFAULT_QUICK_REPLIES);
  const [newQuickReplyModal, setNewQuickReplyModal] = useState<{ open: boolean; title: string; text: string }>({
    open: false,
    title: '',
    text: '',
  });
  const [improvingReplyWithAi, setImprovingReplyWithAi] = useState(false);
  const [replyIncludeWhatsApp, setReplyIncludeWhatsApp] = useState(true);
  const [replyWhatsAppPhone, setReplyWhatsAppPhone] = useState('+593 98 391 0712');
  const [sentReplies, setSentReplies] = useState<SentReplyItem[]>([]);

  useEffect(() => {
    try {
      const savedQr = localStorage.getItem('rifx_custom_quick_replies');
      if (savedQr) {
        const parsed = JSON.parse(savedQr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQuickReplies(parsed);
        }
      }
      const savedWa = localStorage.getItem('rifx_reply_include_whatsapp');
      if (savedWa !== null) {
        setReplyIncludeWhatsApp(savedWa === 'true');
      }
      const savedPhone = localStorage.getItem('rifx_reply_whatsapp_phone');
      if (savedPhone) {
        setReplyWhatsAppPhone(savedPhone);
      }
      const savedReplies = localStorage.getItem('rifx_outreach_sent_replies');
      if (savedReplies) {
        const parsed = JSON.parse(savedReplies);
        if (Array.isArray(parsed)) setSentReplies(parsed);
      }
      const savedOutreachWa = localStorage.getItem('rifx_outreach_include_whatsapp');
      const savedOutreachPhone = localStorage.getItem('rifx_outreach_whatsapp_phone');
      if (savedOutreachWa !== null || savedOutreachPhone) {
        const includeWa = savedOutreachWa !== null ? savedOutreachWa === 'true' : true;
        const phone = savedOutreachPhone || '+593 98 391 0712';
        setDraft(prev => ({
          ...prev,
          include_whatsapp: prev.include_whatsapp !== undefined ? prev.include_whatsapp : includeWa,
          whatsapp_phone: prev.whatsapp_phone || phone,
        }));
        setBulkCampaignDraft(prev => ({
          ...prev,
          include_whatsapp: prev.include_whatsapp !== undefined ? prev.include_whatsapp : includeWa,
          whatsapp_phone: prev.whatsapp_phone || phone,
        }));
      }
    } catch {}
  }, []);

  const toggleStar = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredUids(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };
  const [replyModal, setReplyModal] = useState<{
    to: string;
    contactId?: string;
    business?: string;
    subject: string;
    replyText: string;
  } | null>(null);
  const [sendingReply, setSendingReply] = useState(false);

  const handleSyncInbox = async () => {
    setSyncingInbox(true);
    setMessage('Comprobando buzón de respuestas en Nominalia...');
    try {
      const response = await fetch('/api/panel/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'sync-inbox' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo sincronizar el buzón.');
      }
      if (Array.isArray(result.messages)) {
        setInboxMessages(result.messages);
      }
      setMessage(
        result.updatedCount > 0
          ? `✓ Sincronizado: ${result.updatedCount} prospecto(s) cambiaron automáticamente a estado "Respondió".`
          : '✓ Bandeja de respuestas actualizada con el buzón de Nominalia.'
      );
      void load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al sincronizar respuestas.');
    } finally {
      setSyncingInbox(false);
    }
  };

  const handleDeleteInbox = async (uids: string[]) => {
    if (!uids || uids.length === 0) return;
    setDeletingInbox(true);
    setMessage(`Eliminando ${uids.length} correo(s) directamente de Nominalia para liberar memoria...`);
    try {
      const response = await fetch('/api/panel/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'delete-inbox', uids }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudieron eliminar los mensajes de Nominalia.');
      }

      setInboxMessages(prev => prev.filter(m => !uids.includes(m.uid)));
      setSelectedInboxUids(prev => prev.filter(id => !uids.includes(id)));
      if (activeInboxMessage && uids.includes(activeInboxMessage.uid)) {
        setSelectedInboxUid(null);
      }
      setDeleteConfirmModal(null);
      setMessage(
        `✓ ${result.count || uids.length} correo(s) eliminados permanentemente del servidor de Nominalia. Memoria del buzón liberada.`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al eliminar correos de Nominalia.');
    } finally {
      setDeletingInbox(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyModal || !replyModal.replyText.trim()) return;
    setSendingReply(true);
    setMessage('Enviando respuesta al cliente...');
    try {
      const response = await fetch('/api/panel/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'reply',
          to: replyModal.to,
          subject: replyModal.subject,
          replyText: replyModal.replyText,
          contactId: replyModal.contactId,
          clientBusiness: replyModal.business,
          includeWhatsApp: replyIncludeWhatsApp,
          whatsAppPhone: replyWhatsAppPhone,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo enviar la respuesta.');
      }
      setMessage('✓ Respuesta enviada con éxito al cliente desde ' + sender);
      setReplyModal(null);
      void load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al enviar respuesta.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleImproveReplyWithAi = async (params: {
    draftText: string;
    clientMessage?: string;
    clientName?: string;
    clientBusiness?: string;
    onSuccess: (improved: string) => void;
  }) => {
    if (!params.draftText.trim() && !params.clientMessage?.trim()) {
      setMessage('Escribe un borrador previo o selecciona una respuesta rápida antes de mejorar con IA.');
      return;
    }
    setImprovingReplyWithAi(true);
    setMessage('✨ Perfeccionando mensaje con IA (tono persuasivo y ejecutivo)...');
    try {
      const response = await fetch('/api/panel/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'ai-improve-reply',
          draftText: params.draftText,
          clientMessage: params.clientMessage,
          clientName: params.clientName,
          clientBusiness: params.clientBusiness,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo perfeccionar la respuesta con IA.');
      if (result.improvedText) {
        params.onSuccess(result.improvedText);
        setMessage('✓ Respuesta perfeccionada profesionalmente con Inteligencia Artificial.');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al perfeccionar con IA.');
    } finally {
      setImprovingReplyWithAi(false);
    }
  };

  const handleParsePastedList = (text?: string) => {
    const raw = text !== undefined ? text : bulkPastedText;
    const { validItems, invalidLines, duplicateCount } = parseBulkRecipientList(raw);
    setBulkParsedRecipients(validItems);
    setBulkInvalidLines(invalidLines);
    setBulkDuplicatesCount(duplicateCount);
  };

  const copyEditorDraftToBulk = () => {
    setBulkCampaignDraft({
      ...draft,
      subject: draft.subject.includes('{{negocio}}') ? draft.subject : `${draft.subject} - {{negocio}}`,
    });
    setMessage('✓ Datos copiados del editor a la campaña masiva.');
  };

  const handleStartBulkSend = async () => {
    let recipientsToSend: Array<{ id?: string; email: string; business: string }> = [];

    if (bulkMode === 'crm') {
      const selectedContacts = contacts.filter(c => bulkSelectedIds.includes(c.id));
      if (selectedContacts.length === 0) {
        setMessage('Selecciona al menos un contacto del CRM para iniciar el envío masivo.');
        return;
      }
      recipientsToSend = selectedContacts.map(c => ({
        id: c.id,
        email: c.email,
        business: c.business,
      }));
    } else {
      if (bulkParsedRecipients.length === 0) {
        setMessage('Pega o procesa una lista de correos válida antes de iniciar.');
        return;
      }
      recipientsToSend = bulkParsedRecipients.map(r => ({
        email: r.email,
        business: r.business,
      }));
    }

    if (recipientsToSend.length === 0) {
      setMessage('No hay destinatarios válidos para enviar.');
      return;
    }

    const confirmMsg = `¿Deseas iniciar el envío masivo de propuestas a ${recipientsToSend.length} destinatario(s)?\n\nRemitente: ${sender}\nVelocidad: ${(bulkDelayMs / 1000).toFixed(1)}s por correo`;
    if (!window.confirm(confirmMsg)) return;

    setBulkSending(true);
    bulkStopRef.current = false;
    setBulkRightTab('monitor');
    setMessage(`Iniciando envío masivo a ${recipientsToSend.length} destinatarios...`);

    const initialResults: BulkResultItem[] = recipientsToSend.map(r => ({
      email: r.email,
      business: r.business,
      status: 'pending',
    }));
    setBulkResults(initialResults);
    setBulkProgress({ current: 0, total: recipientsToSend.length, sent: 0, failed: 0 });

    let sentAcc = 0;
    let failedAcc = 0;
    const finalResults: BulkResultItem[] = [...initialResults];

    const CHUNK_SIZE = 10;
    for (let offset = 0; offset < recipientsToSend.length; offset += CHUNK_SIZE) {
      if (bulkStopRef.current) {
        setMessage(`Envío masivo pausado por el usuario. Se procesaron ${offset} de ${recipientsToSend.length}.`);
        break;
      }

      const chunk = recipientsToSend.slice(offset, offset + CHUNK_SIZE);

      try {
        const response = await fetch('/api/panel/outreach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            action: 'bulk-send',
            items: chunk,
            campaignDraft: bulkCampaignDraft,
            delayMs: bulkDelayMs,
            saveToCrm: bulkSaveToCrm,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Error en el lote de envío.');
        }

        if (Array.isArray(data.results)) {
          data.results.forEach((itemRes: any, idx: number) => {
            const globalIndex = offset + idx;
            if (globalIndex < finalResults.length) {
              finalResults[globalIndex] = {
                email: itemRes.email,
                business: itemRes.business,
                status: itemRes.status === 'sent' ? 'sent' : (itemRes.status === 'skipped' ? 'skipped' : 'failed'),
                messageId: itemRes.messageId,
                error: itemRes.error,
              };
              if (itemRes.status === 'sent') sentAcc++;
              else failedAcc++;
            }
          });
        }

        setBulkProgress({
          current: Math.min(offset + chunk.length, recipientsToSend.length),
          total: recipientsToSend.length,
          sent: sentAcc,
          failed: failedAcc,
        });
        setBulkResults([...finalResults]);
      } catch (err: any) {
        console.error('Error in bulk batch:', err);
        chunk.forEach((_, idx) => {
          const globalIndex = offset + idx;
          if (globalIndex < finalResults.length) {
            finalResults[globalIndex] = {
              ...finalResults[globalIndex],
              status: 'failed',
              error: err instanceof Error ? err.message : 'Error al enviar lote',
            };
            failedAcc++;
          }
        });
        setBulkResults([...finalResults]);
        setBulkProgress({
          current: Math.min(offset + chunk.length, recipientsToSend.length),
          total: recipientsToSend.length,
          sent: sentAcc,
          failed: failedAcc,
        });
      }
    }

    setBulkSending(false);
    setMessage(
      bulkStopRef.current
        ? `Envío masivo detenido. Exitosos: ${sentAcc}, Fallidos: ${failedAcc}.`
        : `✓ Envío masivo completado. ${sentAcc} correo(s) enviados con éxito, ${failedAcc} fallido(s).`
    );
    void load();
  };

  const handleImageFile = async (file: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setMessage('Elige un archivo de imagen válido (JPG, PNG o WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('La foto no puede superar los 5 MB.');
      return;
    }

    // 1. Mostrar preview inmediato en el editor y en la previsualización del correo
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraft(prev => ({ ...prev, image_url: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);

    // 2. Subir al servidor en segundo plano
    setUploadingImage(true);
    setMessage('Subiendo foto desde tu galería...');
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/panel/outreach/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo subir la foto.');
      }

      if (result.imageUrl) {
        setDraft(prev => ({ ...prev, image_url: result.imageUrl }));
        setMessage('📷 Foto cargada con éxito desde tu galería.');
      }
    } catch (err) {
      console.warn('[Outreach Gallery Upload] Usando vista local:', err);
      setMessage('📷 Foto cargada correctamente desde tu dispositivo.');
    } finally {
      setUploadingImage(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/panel/outreach', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'No se pudo cargar el módulo.');
      }
      setContacts(result.contacts || []);
      setTemplates(result.templates || []);
      if (Array.isArray(result.inbox)) setInboxMessages(result.inbox);
      setReady(true);
      setSmtpReady(result.smtpReady);
      setTestEmail(result.testEmail || '');
      if (result.sender) setSender(result.sender);

      setMessage(
        result.smtpReady
          ? 'Conexión SMTP con Nominalia activa. Puedes enviar pruebas y propuestas reales.'
          : 'Modo edición listo. Configura las variables SMTP de Nominalia en el servidor para enviar correos.'
      );
    } catch (error) {
      setReady(false);
      setMessage(error instanceof Error ? error.message : 'No se pudo conectar con el servidor.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const valid =
    Boolean(
      draft.business.trim() &&
      draft.email.trim() &&
      draft.subject.trim() &&
      draft.observation.trim() &&
      draft.proposal.trim()
    ) &&
    validOutreachEmail(draft.email) &&
    !/[\r\n]/.test(draft.subject);

  const dirty =
    !selected ||
    draft.business !== selected.business ||
    draft.email !== selected.email ||
    draft.subject !== selected.subject ||
    draft.observation !== selected.observation ||
    draft.proposal !== selected.proposal ||
    (draft.price || 'USD 300') !== (selected.price || 'USD 300') ||
    (draft.service_title || 'Gestión de anuncios publicitarios') !== (selected.service_title || 'Gestión de anuncios publicitarios') ||
    (draft.deliverables || '12 piezas gráficas • 3 videos editables') !== (selected.deliverables || '12 piezas gráficas • 3 videos editables') ||
    (draft.deliverables_note || 'La inversión en anuncios se paga por separado.') !== (selected.deliverables_note || 'La inversión en anuncios se paga por separado.') ||
    (draft.image_url || '') !== (selected.image_url || '') ||
    (draft.template_html || null) !== (selected.template_html || null) ||
    (draft.include_whatsapp !== false) !== (selected.include_whatsapp !== false) ||
    (draft.whatsapp_phone || '+593 98 391 0712') !== (selected.whatsapp_phone || '+593 98 391 0712');

  const locked = Boolean(selected && selected.delivery_status !== 'draft');

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/panel/outreach', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', ...draft, id: selected?.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSelected(result.contact);
      setDraft({
        business: result.contact.business,
        email: result.contact.email,
        subject: result.contact.subject,
        observation: result.contact.observation,
        proposal: result.contact.proposal,
        price: result.contact.price || 'USD 300',
        service_title: result.contact.service_title || 'Gestión de anuncios publicitarios',
        deliverables: result.contact.deliverables || '12 piezas gráficas • 3 videos editables',
        deliverables_note: result.contact.deliverables_note || 'La inversión en anuncios se paga por separado.',
        image_url: result.contact.image_url || '',
        template_html: result.contact.template_html,
        include_whatsapp: result.contact.include_whatsapp !== false,
        whatsapp_phone: result.contact.whatsapp_phone || '+593 98 391 0712',
      });
      await load();
      setMessage('Propuesta guardada correctamente. Ya puedes probarla o enviarla.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la propuesta.');
    } finally {
      setBusy(false);
    }
  };

  const generateAiProposal = async (customPrompt?: string) => {
    const textPrompt = customPrompt || aiPrompt;
    if (!textPrompt.trim() || aiGenerating) return;
    setAiGenerating(true);
    setAiFeedback(null);
    try {
      const response = await fetch('/api/panel/outreach', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai-generate',
          prompt: textPrompt.trim(),
          style: aiStyle,
          language: aiLanguage,
          business: draft.business,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al generar la propuesta.');
      setAiResult(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al conectar con el Asistente AI.');
    } finally {
      setAiGenerating(false);
    }
  };

  const applyAiToEmail = (mode: 'all' | 'proposal_only' | 'copy') => {
    if (!aiResult) return;

    if (mode === 'copy') {
      const textToCopy = aiResult.full_draft || aiResult.proposal || '';
      void navigator.clipboard.writeText(textToCopy);
      setMessage('📋 Texto copiado al portapapeles.');
      return;
    }

    if (mode === 'proposal_only') {
      setDraft(prev => ({
        ...prev,
        proposal: aiResult.proposal || prev.proposal,
      }));
      setMessage('✨ Propuesta redactada aplicada al correo.');
      setShowAiModal(false);
      return;
    }

    setDraft(prev => ({
      ...prev,
      subject: aiResult.subject || prev.subject,
      observation: aiResult.observation || prev.observation,
      proposal: aiResult.proposal || prev.proposal,
      service_title: aiResult.service_title || prev.service_title,
      price: aiResult.price || prev.price,
      deliverables: aiResult.deliverables || prev.deliverables,
      deliverables_note: aiResult.deliverables_note || prev.deliverables_note,
    }));
    setMessage('✨ Propuesta completa y personalizada aplicada a todos los campos del correo.');
    setShowAiModal(false);
  };

  const send = async (test: boolean) => {
    if (busy) return;
    setBusy(true);
    setConfirming(false);
    try {
      let targetId = selected?.id;

      if (!test) {
        const saveRes = await fetch('/api/panel/outreach', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save', ...draft, id: targetId }),
        });
        const saveResult = await saveRes.json();
        if (!saveRes.ok) {
          throw new Error(saveResult.error || 'No se pudo guardar la propuesta antes de enviar.');
        }
        setSelected(saveResult.contact);
        targetId = saveResult.contact.id;
      }

      const response = await fetch('/api/panel/outreach', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          test
            ? { action: 'test', ...draft }
            : { action: 'send', id: targetId, confirmed: true }
        ),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!test && selected) {
        setSelected({ ...selected, delivery_status: 'sent', sent_at: new Date().toISOString() });
      }
      await load();
      setMessage(
        test
          ? `¡Prueba enviada con éxito! Revisa tu bandeja de entrada en: ${testEmail || 'tu correo de pruebas'}.`
          : '¡Propuesta comercial enviada con éxito! Las respuestas llegarán directamente a tu buzón.'
      );
    } catch (error) {
      await load();
      if (!test && selected) {
        setSelected({ ...selected, delivery_status: 'uncertain' });
      }
      setMessage(error instanceof Error ? error.message : 'No se pudo enviar el correo.');
    } finally {
      setBusy(false);
    }
  };

  const setStage = async (contact: Contact, stage: string) => {
    setBusy(true);
    try {
      const response = await fetch('/api/panel/outreach', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stage', id: contact.id, stage }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (selected?.id === contact.id) setSelected(result.contact);
      await load();
      setMessage('Estado de seguimiento actualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el estado.');
    } finally {
      setBusy(false);
    }
  };

  const preview = renderOutreach(draft, sender).html;

  const useCustomTemplate = () => {
    const html = prepareOutreachTemplate(templateCode);
    if (!html) {
      setMessage('El HTML debe incluir {{negocio}} y {{propuesta}}, y pesar menos de 64 KB.');
      return;
    }
    setDraft({ ...draft, template_html: html });
    setMessage('Diseño personalizado aplicado a la vista previa.');
  };

  const saveTemplate = async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/panel/outreach', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-template', name: templateName, html: templateCode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setDraft({ ...draft, template_html: result.template.html });
      await load();
      setMessage('Plantilla guardada en tu biblioteca y aplicada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar la plantilla.');
    } finally {
      setBusy(false);
    }
  };

  const readTemplateFile = async (file?: File) => {
    if (!file) return;
    if (!/\.html?$/i.test(file.name) || file.size > 64_000) {
      setMessage('Elige un archivo .html de hasta 64 KB.');
      return;
    }
    try {
      setTemplateCode(await file.text());
      setTemplateName(file.name.replace(/\.html?$/i, '').slice(0, 100));
      setMessage('Archivo HTML cargado. Pulsa "Probar diseño" para previsualizar.');
    } catch {
      setMessage('No se pudo leer el archivo.');
    }
  };

  const selectContact = (c: Contact) => {
    setSelected(c);
    setDraft({
      business: c.business,
      email: c.email,
      subject: c.subject,
      observation: c.observation,
      proposal: c.proposal,
      price: c.price || 'USD 300',
      service_title: c.service_title || 'Gestión de anuncios publicitarios',
      deliverables: c.deliverables || '12 piezas gráficas • 3 videos editables',
      deliverables_note: c.deliverables_note || 'La inversión en anuncios se paga por separado.',
      image_url: c.image_url || '',
      template_html: c.template_html,
      include_whatsapp: c.include_whatsapp !== false,
      whatsapp_phone: c.whatsapp_phone || '+593 98 391 0712',
    });
    setConfirming(false);
    setShowContactList(false);
  };

  const startNewContact = () => {
    setSelected(null);
    let defaultIncludeWa = true;
    let defaultPhone = '+593 98 391 0712';
    try {
      const savedWa = localStorage.getItem('rifx_outreach_include_whatsapp');
      if (savedWa !== null) defaultIncludeWa = savedWa === 'true';
      const savedPhone = localStorage.getItem('rifx_outreach_whatsapp_phone');
      if (savedPhone) defaultPhone = savedPhone;
    } catch {}
    setDraft({
      ...emptyDraft,
      include_whatsapp: defaultIncludeWa,
      whatsapp_phone: defaultPhone,
    });
    setConfirming(false);
    setShowContactList(false);
  };

  const inboxThreads = useMemo<InboxThread[]>(() => {
    const threadMap = new Map<string, {
      threadId: string;
      clientEmail: string;
      clientName: string;
      matchedContactBusiness?: string;
      matchedContactId?: string;
      messages: typeof inboxMessages;
    }>();

    for (const msg of inboxMessages) {
      const key = (msg.fromEmail || '').toLowerCase().trim() || `uid-${msg.uid}`;
      const existing = threadMap.get(key);
      if (existing) {
        existing.messages.push(msg);
        if (!existing.matchedContactBusiness && msg.matchedContactBusiness) {
          existing.matchedContactBusiness = msg.matchedContactBusiness;
        }
        if (!existing.matchedContactId && msg.matchedContactId) {
          existing.matchedContactId = msg.matchedContactId;
        }
        if (msg.fromName && (!existing.clientName || existing.clientName === existing.clientEmail)) {
          existing.clientName = msg.fromName;
        }
      } else {
        threadMap.set(key, {
          threadId: key,
          clientEmail: msg.fromEmail,
          clientName: msg.fromName || msg.fromEmail,
          matchedContactBusiness: msg.matchedContactBusiness,
          matchedContactId: msg.matchedContactId,
          messages: [msg],
        });
      }
    }

    const threads: InboxThread[] = [];
    for (const item of threadMap.values()) {
      const sorted = [...item.messages].sort((a, b) => {
        const tA = new Date(a.date).getTime() || 0;
        const tB = new Date(b.date).getTime() || 0;
        return tA - tB;
      });
      const latest = sorted[sorted.length - 1];
      const uids = sorted.map(m => m.uid);
      const isStarred = uids.some(id => starredUids.includes(id));

      threads.push({
        threadId: item.threadId,
        clientEmail: item.clientEmail,
        clientName: item.clientName,
        matchedContactBusiness: item.matchedContactBusiness,
        matchedContactId: item.matchedContactId,
        latestSubject: latest.subject || '(Sin asunto)',
        latestSnippet: latest.snippet || '',
        latestDate: latest.date,
        messages: sorted,
        uids,
        isStarred,
      });
    }

    threads.sort((a, b) => {
      const tA = new Date(a.latestDate).getTime() || 0;
      const tB = new Date(b.latestDate).getTime() || 0;
      return tB - tA;
    });

    return threads;
  }, [inboxMessages, starredUids]);

  const filteredThreads = useMemo<InboxThread[]>(() => {
    return inboxThreads.filter((t: InboxThread) => {
      if (inboxCategoryFilter === 'crm' && !t.matchedContactBusiness) return false;
      if (inboxCategoryFilter === 'starred' && !t.isStarred) return false;
      if (inboxSearch.trim()) {
        const q = inboxSearch.toLowerCase();
        const matchSender = t.clientName.toLowerCase().includes(q) || t.clientEmail.toLowerCase().includes(q);
        const matchSubject = t.latestSubject.toLowerCase().includes(q);
        const matchBusiness = (t.matchedContactBusiness || '').toLowerCase().includes(q);
        const matchSnippet = t.messages.some(m => (m.snippet || '').toLowerCase().includes(q));
        if (!matchSender && !matchSubject && !matchBusiness && !matchSnippet) return false;
      }
      return true;
    });
  }, [inboxThreads, inboxCategoryFilter, inboxSearch]);

  const activeInboxMessage = selectedInboxUid
    ? inboxMessages.find(m => m.uid === selectedInboxUid) || null
    : null;

  const activeThread = activeInboxMessage
    ? inboxThreads.find(t => t.threadId === (activeInboxMessage.fromEmail || '').toLowerCase().trim()) || {
        threadId: (activeInboxMessage.fromEmail || '').toLowerCase().trim(),
        clientEmail: activeInboxMessage.fromEmail,
        clientName: activeInboxMessage.fromName || activeInboxMessage.fromEmail,
        matchedContactBusiness: activeInboxMessage.matchedContactBusiness,
        matchedContactId: activeInboxMessage.matchedContactId,
        latestSubject: activeInboxMessage.subject,
        latestSnippet: activeInboxMessage.snippet,
        latestDate: activeInboxMessage.date,
        messages: [activeInboxMessage],
        uids: [activeInboxMessage.uid],
        isStarred: starredUids.includes(activeInboxMessage.uid),
      }
    : null;

  const activeMatchedContact = activeInboxMessage?.matchedContactId
    ? contacts.find(c => c.id === activeInboxMessage.matchedContactId) || null
    : activeThread?.clientEmail
    ? contacts.find(c => c.email && c.email.toLowerCase().trim() === activeThread.clientEmail.toLowerCase().trim()) || null
    : null;

  const filteredInboxMessages = inboxMessages.filter(m => {
    if (inboxCategoryFilter === 'crm' && !m.matchedContactBusiness) return false;
    if (inboxCategoryFilter === 'starred' && !starredUids.includes(m.uid)) return false;
    if (inboxSearch.trim()) {
      const q = inboxSearch.toLowerCase();
      const matchSender = (m.fromName || '').toLowerCase().includes(q) || (m.fromEmail || '').toLowerCase().includes(q);
      const matchSubject = (m.subject || '').toLowerCase().includes(q);
      const matchSnippet = (m.snippet || '').toLowerCase().includes(q);
      const matchBusiness = (m.matchedContactBusiness || '').toLowerCase().includes(q);
      if (!matchSender && !matchSubject && !matchSnippet && !matchBusiness) return false;
    }
    return true;
  });

  const mainContent = (
    <div className={embedded ? 'w-full' : 'mx-auto max-w-7xl'}>
      {!embedded && (
        <Link
          href="/panel"
          className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900 transition-colors"
        >
          ← Volver al panel
        </Link>
      )}

      {/* Encabezado */}
      <header className={`${embedded ? 'mb-5 mt-1' : 'my-6'} flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-600">Rifx Marketing</span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">Módulo Comercial</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Correos y prospectos
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Redacta en el lado izquierdo y visualiza en tiempo real el diseño final para tu cliente en el lado derecho.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!aiPrompt && draft.observation) {
                setAiPrompt(`Redacta una propuesta de marketing para ${draft.business || 'este negocio'}. Observación: ${draft.observation}`);
              }
              setShowAiModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:from-blue-800 hover:to-indigo-700 transition-all hover:shadow active:scale-95"
          >
            <span>✨</span>
            <span>Asistente de escritura AI</span>
            <span className="rounded bg-emerald-500 px-1.5 py-0.2 text-[9px] font-black uppercase text-white shadow-xs">NEW</span>
          </button>

          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold shadow-sm ${
              smtpReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${smtpReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {smtpReady ? `Nominalia Conectado (${sender})` : 'SMTP Pendiente'}
          </span>
        </div>
      </header>

      {/* Tarjetas de Métricas Rápidas */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Contactos guardados', contacts.length],
          ['Envíos realizados', contacts.filter(c => c.delivery_status === 'sent').length],
          ['Respondieron', contacts.filter(c => ['replied', 'meeting', 'won'].includes(c.stage)).length],
          ['Contratados / Ganados', contacts.filter(c => c.stage === 'won').length],
        ].map(([label, count]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{count}</p>
          </div>
        ))}
      </div>

      {/* Mensaje de estado */}
      <div
        role="status"
        aria-live="polite"
        className="mb-5 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-xs sm:text-sm text-blue-950 backdrop-blur-sm"
      >
        <span>{message}</span>
        {!ready && (
          <Link href="/panel" className="ml-2 font-bold underline hover:text-blue-800">
            Ir al panel
          </Link>
        )}
      </div>

      {/* Selector de Pestaña Principal: Editor vs Envíos Masivos vs Bandeja de Respuestas */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'editor'
                ? 'bg-[#103260] text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>📝</span>
            <span>Redactar Propuesta</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bulk')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'bulk'
                ? 'bg-[#103260] text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>🚀</span>
            <span>Envíos Masivos</span>
            <span className="rounded-full bg-[#f27121] text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
              Campaña
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('inbox');
              if (inboxMessages.length === 0) void handleSyncInbox();
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'inbox'
                ? 'bg-[#103260] text-white shadow-sm'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>📥</span>
            <span>Bandeja de Respuestas</span>
            {inboxMessages.length > 0 && (
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-white">
                {inboxMessages.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'inbox' && (
          <button
            type="button"
            disabled={syncingInbox}
            onClick={() => void handleSyncInbox()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 transition shadow-xs disabled:opacity-50"
          >
            <span className={syncingInbox ? 'animate-spin' : ''}>🔄</span>
            <span>{syncingInbox ? 'Comprobando buzón...' : 'Comprobar nuevas respuestas'}</span>
          </button>
        )}
      </div>

      {/* ============================================================== */}
      {/* VISTA 1: BANDEJA DE RESPUESTAS DE CLIENTES                     */}
      {/* ============================================================== */}
      {/* ============================================================== */}
      {/* VISTA 1: BANDEJA DE RESPUESTAS (SPLIT SCREEN)                  */}
      {/* ============================================================== */}
      {activeTab === 'inbox' && (
        <div className="space-y-5 pb-36">
          {inboxMessages.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
              <span className="text-4xl">📭</span>
              <p className="mt-3 font-extrabold text-slate-800 text-base">No hay respuestas en tu buzón todavía</p>
              <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                Toca el botón para conectarte a Nominalia y comprobar si algún cliente te ha contestado.
              </p>
              <button
                type="button"
                disabled={syncingInbox}
                onClick={() => void handleSyncInbox()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition disabled:opacity-50"
              >
                <span className={syncingInbox ? 'animate-spin' : ''}>🔄</span>
                <span>Comprobar buzón ahora</span>
              </button>
            </div>
          ) : !activeInboxMessage ? (
            /* ------------------------------------------------------------ */
            /* PANTALLA 1: LISTA GENERAL DE CORREOS (ESTILO GMAIL / WEBMAIL) */
            /* ------------------------------------------------------------ */
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-in fade-in duration-150 min-h-[500px]">
              
              {/* Barra superior de pestañas de categoría y buscador */}
              <div className="border-b border-slate-200 bg-white p-3 sm:p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  
                  {/* Selector maestro y Basurero minimalista + Categorías */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    
                    {/* Selector maestro y basurero minimalista integrado al CRM */}
                    <div className="flex items-center gap-1.5 pr-2 mr-0.5 border-r border-slate-200">
                      <input
                        type="checkbox"
                        checked={filteredThreads.length > 0 && filteredThreads.every((t: InboxThread) => t.uids.every((id: string) => selectedInboxUids.includes(id)))}
                        onChange={e => {
                          if (e.target.checked) {
                            const allUids: string[] = Array.from(new Set(filteredThreads.flatMap((t: InboxThread) => t.uids)));
                            setSelectedInboxUids(allUids);
                          } else {
                            setSelectedInboxUids([]);
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer transition"
                        title={selectedInboxUids.length > 0 ? 'Desmarcar todos' : 'Seleccionar todas las conversaciones'}
                      />

                      {/* Solo asoma el basurero minimalista cuando hay correos seleccionados */}
                      {selectedInboxUids.length > 0 && (
                        <button
                          type="button"
                          disabled={deletingInbox}
                          onClick={() => setDeleteConfirmModal({
                            uids: selectedInboxUids,
                            description: `${selectedInboxUids.length} correo(s) seleccionado(s)`,
                          })}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-600 transition-all shadow-2xs active:scale-95 animate-in fade-in zoom-in-90 disabled:opacity-50"
                          title={`Eliminar ${selectedInboxUids.length} correo(s) de Nominalia para liberar memoria`}
                          aria-label="Eliminar seleccionados"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setInboxCategoryFilter('all')}
                      className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition-all rounded-xl ${
                        inboxCategoryFilter === 'all'
                          ? 'bg-blue-50 text-blue-700 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span>📥</span>
                      <span>Principal</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        inboxCategoryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {inboxThreads.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInboxCategoryFilter('crm')}
                      className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition-all rounded-xl ${
                        inboxCategoryFilter === 'crm'
                          ? 'bg-blue-50 text-blue-700 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span>🏢</span>
                      <span>Clientes CRM</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        inboxCategoryFilter === 'crm' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {inboxThreads.filter(t => !!t.matchedContactBusiness).length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInboxCategoryFilter('starred')}
                      className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold transition-all rounded-xl ${
                        inboxCategoryFilter === 'starred'
                          ? 'bg-blue-50 text-blue-700 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <span>⭐</span>
                      <span>Destacados</span>
                      {inboxThreads.filter(t => t.isStarred).length > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          inboxCategoryFilter === 'starred' ? 'bg-blue-600 text-white' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {inboxThreads.filter(t => t.isStarred).length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Buscador de correos y botón de refrescar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="🔍 Buscar en correos..."
                        value={inboxSearch}
                        onChange={e => setInboxSearch(e.target.value)}
                        className="w-48 sm:w-64 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      {inboxSearch && (
                        <button
                          type="button"
                          onClick={() => setInboxSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={syncingInbox}
                      onClick={() => void handleSyncInbox()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition shadow-2xs disabled:opacity-50"
                      title="Actualizar buzón de Nominalia"
                    >
                      <span className={syncingInbox ? 'animate-spin' : ''}>🔄</span>
                      <span className="hidden sm:inline">{syncingInbox ? 'Actualizando...' : 'Actualizar'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabla de correos (Como en la captura de Gmail) */}
              <div className="divide-y divide-slate-100">
                {filteredThreads.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <span className="text-3xl">📭</span>
                    <p className="mt-2 font-bold text-slate-700 text-sm">No se encontraron conversaciones en esta vista</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {inboxSearch ? 'Prueba con otro término de búsqueda.' : 'Toca "Actualizar" para sincronizar correos con Nominalia.'}
                    </p>
                  </div>
                ) : (
                  filteredThreads.map(thread => {
                    const isChecked = thread.uids.length > 0 && thread.uids.every(id => selectedInboxUids.includes(id));
                    const latestMsg = thread.messages[thread.messages.length - 1];
                    return (
                      <div
                        key={thread.threadId}
                        onClick={() => {
                          setSelectedInboxUid(latestMsg.uid);
                          setInboxReplySubject(latestMsg.subject.startsWith('Re:') ? latestMsg.subject : `Re: ${latestMsg.subject}`);
                          setInboxReplyText('');
                        }}
                        className="group flex items-center gap-3 px-4 py-3 hover:bg-blue-50/40 cursor-pointer transition-colors border-l-4 border-l-transparent hover:border-l-blue-600"
                      >
                        {/* Checkbox */}
                        <div className="shrink-0 flex items-center" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedInboxUids(Array.from(new Set([...selectedInboxUids, ...thread.uids])));
                              } else {
                                setSelectedInboxUids(selectedInboxUids.filter(id => !thread.uids.includes(id)));
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </div>

                        {/* Estrella */}
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            toggleStar(latestMsg.uid, e);
                          }}
                          className="shrink-0 text-base leading-none transition-transform active:scale-125"
                          title={thread.isStarred ? 'Quitar de destacados' : 'Destacar conversación'}
                        >
                          {thread.isStarred ? (
                            <span className="text-amber-500">★</span>
                          ) : (
                            <span className="text-slate-300 group-hover:text-slate-400">☆</span>
                          )}
                        </button>

                        {/* Remitente / Empresa + Notificación de múltiples respuestas */}
                        <div className="w-48 sm:w-60 shrink-0 truncate flex items-center gap-1.5">
                          {thread.matchedContactBusiness ? (
                            <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                              🏢 {thread.matchedContactBusiness}
                            </span>
                          ) : (
                            <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                              {thread.clientName}
                            </span>
                          )}
                          {thread.messages.length > 1 && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-800 border border-blue-200/90 shadow-2xs shrink-0"
                              title={`${thread.messages.length} mensajes recibidos en esta conversación`}
                            >
                              <span>💬</span>
                              <span>{thread.messages.length} respuestas</span>
                            </span>
                          )}
                        </div>

                        {/* Asunto + Separador + Extracto de mensaje */}
                        <div className="flex-1 min-w-0 truncate text-xs sm:text-sm">
                          <span className="font-bold text-slate-900">
                            {thread.latestSubject}
                          </span>
                          <span className="text-slate-400 mx-1.5 font-normal">-</span>
                          <span className="text-slate-500 font-normal">
                            {thread.latestSnippet || 'Sin vista previa disponible'}
                          </span>
                        </div>

                        {/* Fecha o Hora + Basurero minimalista en hover */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-600 min-w-[60px] text-right">
                            {formatInboxDate(thread.latestDate)}
                          </span>
                          <button
                            type="button"
                            disabled={deletingInbox}
                            onClick={e => {
                              e.stopPropagation();
                              setDeleteConfirmModal({
                                uids: thread.uids,
                                description: `la conversación de ${thread.clientName} (${thread.messages.length} correo${thread.messages.length > 1 ? 's' : ''})`,
                              });
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg p-1.5 transition-all"
                            title="Eliminar esta conversación de Nominalia"
                            aria-label="Eliminar conversación"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pie de lista con resumen */}
              {filteredThreads.length > 0 && (
                <div className="bg-slate-50/70 border-t border-slate-100 px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Mostrando {filteredThreads.length} conversación(es) ({inboxMessages.length} correo(s) en total en tu buzón)
                  </span>
                  <span className="font-mono text-slate-400">
                    Buzón Nominalia: {sender}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* ------------------------------------------------------------ */
            /* PANTALLA 2: RESPUESTA DEDICADA AL CORREO SELECCIONADO        */
            /* ------------------------------------------------------------ */
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* Barra superior de navegación de vuelta a la lista y botón de borrado */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedInboxUid(null)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition active:scale-95 shadow-2xs"
                  >
                    <span>←</span>
                    <span>Volver a la bandeja</span>
                  </button>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 truncate">
                    <span>Conversación con:</span>
                    <strong className="text-slate-900 font-bold">{activeThread?.clientName || activeInboxMessage.fromName || activeInboxMessage.fromEmail}</strong>
                    {activeThread?.matchedContactBusiness && (
                      <span className="rounded-md bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
                        🏢 {activeThread.matchedContactBusiness}
                      </span>
                    )}
                    {activeThread && activeThread.messages.length > 1 && (
                      <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-black border border-emerald-200">
                        💬 {activeThread.messages.length} mensajes en este hilo
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Basurero minimalista en cabecera de respuesta */}
                  <button
                    type="button"
                    disabled={deletingInbox}
                    onClick={() => setDeleteConfirmModal({
                      uids: activeThread?.uids || [activeInboxMessage.uid],
                      description: `la conversación completa de ${activeThread?.clientName || activeInboxMessage.fromName || activeInboxMessage.fromEmail}`,
                    })}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-red-600 transition-all shadow-2xs active:scale-95 disabled:opacity-50"
                    title="Eliminar esta conversación completa de Nominalia"
                    aria-label="Eliminar conversación de Nominalia"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>

                  <span className="text-slate-300">|</span>

                  {(() => {
                    const currentThreadIdx = inboxThreads.findIndex(t => t.threadId === activeThread?.threadId);
                    return (
                      <>
                        <span className="text-xs text-slate-400 font-medium">
                          {currentThreadIdx >= 0 ? currentThreadIdx + 1 : 1} de {inboxThreads.length}
                        </span>
                        <button
                          type="button"
                          disabled={currentThreadIdx <= 0}
                          onClick={() => {
                            if (currentThreadIdx > 0) {
                              const prevThread = inboxThreads[currentThreadIdx - 1];
                              const lastMsg = prevThread.messages[prevThread.messages.length - 1];
                              setSelectedInboxUid(lastMsg.uid);
                              setInboxReplySubject(lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`);
                              setInboxReplyText('');
                            }
                          }}
                          className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 p-1.5 text-xs text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition"
                          title="Conversación anterior"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          disabled={currentThreadIdx < 0 || currentThreadIdx >= inboxThreads.length - 1}
                          onClick={() => {
                            if (currentThreadIdx >= 0 && currentThreadIdx < inboxThreads.length - 1) {
                              const nextThread = inboxThreads[currentThreadIdx + 1];
                              const lastMsg = nextThread.messages[nextThread.messages.length - 1];
                              setSelectedInboxUid(lastMsg.uid);
                              setInboxReplySubject(lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`);
                              setInboxReplyText('');
                            }
                          }}
                          className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 p-1.5 text-xs text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition"
                          title="Conversación siguiente"
                        >
                          ▶
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Grid de 2 Columnas: Redactar a la izquierda, Vista previa a la derecha */}
              <div className="grid gap-6 lg:grid-cols-2 items-start">
                
                {/* COLUMNA IZQUIERDA: FORMULARIO DE RESPUESTA DEDICADO */}
                <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                        <span>✍️</span>
                        <span>Redactar respuesta para {activeInboxMessage.fromName || activeInboxMessage.fromEmail}</span>
                      </h3>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
                        Desde {sender}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Destinatario
                        </label>
                        <input
                          disabled
                          className={`${inputClass} bg-slate-50 text-slate-700 font-mono text-xs`}
                          value={activeInboxMessage.fromEmail}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Asunto del correo
                        </label>
                        <input
                          disabled={sendingInboxReply}
                          className={inputClass}
                          value={inboxReplySubject || (activeInboxMessage.subject.startsWith('Re:') ? activeInboxMessage.subject : `Re: ${activeInboxMessage.subject}`)}
                          onChange={e => setInboxReplySubject(e.target.value)}
                        />
                      </div>

                      {/* Plantillas de respuesta rápida (Predeterminadas y Personalizadas) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <span>⚡</span>
                            <span>Respuestas rápidas de 1 clic:</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setNewQuickReplyModal({ open: true, title: '', text: '' })}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2 py-0.5 text-[11px] transition shadow-2xs"
                            title="Crear y guardar una nueva respuesta personalizada"
                          >
                            <span>+</span>
                            <span>Nueva respuesta</span>
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {quickReplies.map(qr => (
                            <div
                              key={qr.id}
                              className="group inline-flex items-center rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200/80 transition shadow-2xs"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  const name = activeInboxMessage.fromName || '';
                                  const filled = (qr.text || '')
                                    .replace(/\{\{nombre\}\}/g, name)
                                    .replace(/\{nombre\}/g, name);
                                  setInboxReplyText(filled);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold text-blue-800 transition"
                              >
                                {qr.title}
                              </button>
                              {!qr.isDefault && (
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    const updated = quickReplies.filter(q => q.id !== qr.id);
                                    setQuickReplies(updated);
                                    try {
                                      localStorage.setItem('rifx_custom_quick_replies', JSON.stringify(updated));
                                    } catch {}
                                  }}
                                  title="Eliminar respuesta personalizada"
                                  className="pr-2 pl-0.5 text-blue-400 hover:text-rose-600 text-xs font-bold transition"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Caja de texto de redacción con botón Mejorar con IA */}
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            Mensaje de respuesta
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={improvingReplyWithAi || sendingInboxReply}
                              onClick={() => {
                                void handleImproveReplyWithAi({
                                  draftText: inboxReplyText,
                                  clientMessage: activeInboxMessage.snippet,
                                  clientName: activeInboxMessage.fromName,
                                  clientBusiness: activeInboxMessage.matchedContactBusiness,
                                  onSuccess: improved => setInboxReplyText(improved),
                                });
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-700 hover:from-purple-700 hover:to-blue-800 text-white px-3 py-1 text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-40"
                              title="Perfecciona la redacción, cortesía y persuasión comercial con Inteligencia Artificial"
                            >
                              {improvingReplyWithAi ? (
                                <>
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                  <span>Mejorando con IA...</span>
                                </>
                              ) : (
                                <>
                                  <span>✨</span>
                                  <span>Mejorar con IA</span>
                                </>
                              )}
                            </button>

                            <span className="text-[11px] text-blue-700 font-semibold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md">
                              <span>👁️</span>
                              <span>Se previsualiza a la derecha</span>
                            </span>
                          </div>
                        </div>

                        <textarea
                          rows={11}
                          disabled={sendingInboxReply || improvingReplyWithAi}
                          value={inboxReplyText}
                          onChange={e => setInboxReplyText(e.target.value)}
                          placeholder="Escribe aquí tu respuesta comercial para el cliente..."
                          className="w-full rounded-xl border border-slate-300 p-3.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 leading-relaxed resize-none shadow-xs"
                        />

                        <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200/80 p-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                          <span>🛡️</span>
                          <span>
                            Tu mensaje viaja formateado automáticamente con cabecera azul marino, franja tomate, cita del cliente
                            {replyIncludeWhatsApp ? ' y botón directo a WhatsApp' : ''}.
                          </span>
                        </div>
                      </div>

                      {/* Configuración de WhatsApp en la respuesta (Opcional + Editable + Botón Limpio) */}
                      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={replyIncludeWhatsApp}
                              onChange={e => {
                                setReplyIncludeWhatsApp(e.target.checked);
                                try {
                                  localStorage.setItem('rifx_reply_include_whatsapp', String(e.target.checked));
                                } catch {}
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <WhatsAppIcon className="h-4 w-4" fill="#25D366" />
                              <span>Incluir botón de WhatsApp en la respuesta</span>
                            </span>
                          </label>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              replyIncludeWhatsApp ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {replyIncludeWhatsApp ? 'Botón Activo' : 'Omitido'}
                          </span>
                        </div>

                        {replyIncludeWhatsApp && (
                          <div className="pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                Número de WhatsApp (editable)
                              </label>
                              <input
                                type="text"
                                value={replyWhatsAppPhone}
                                onChange={e => {
                                  setReplyWhatsAppPhone(e.target.value);
                                  try {
                                    localStorage.setItem('rifx_reply_whatsapp_phone', e.target.value);
                                  } catch {}
                                }}
                                placeholder="+593 98 391 0712"
                                className="w-full rounded-lg border border-slate-300 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                              />
                            </div>
                            <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2 border border-slate-200/60 leading-tight">
                              El botón en el correo se mostrará limpio como <strong>"Chatear por WhatsApp"</strong> con el logo oficial. El número no se expone en el botón.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Botón de Enviar Respuesta */}
                      <div className="pt-1">
                        <button
                          type="button"
                          disabled={sendingInboxReply || improvingReplyWithAi || !inboxReplyText.trim()}
                          onClick={async () => {
                            if (!activeInboxMessage || !inboxReplyText.trim()) return;
                            setSendingInboxReply(true);
                            setMessage('Enviando respuesta con marco oficial al cliente...');
                            try {
                              const response = await fetch('/api/panel/outreach', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'same-origin',
                                body: JSON.stringify({
                                  action: 'reply',
                                  to: activeInboxMessage.fromEmail,
                                  subject: inboxReplySubject || `Re: ${activeInboxMessage.subject}`,
                                  replyText: inboxReplyText,
                                  contactId: activeInboxMessage.matchedContactId,
                                  clientName: activeInboxMessage.fromName,
                                  clientBusiness: activeInboxMessage.matchedContactBusiness,
                                  originalMessage: activeInboxMessage.snippet,
                                  includeWhatsApp: replyIncludeWhatsApp,
                                  whatsAppPhone: replyWhatsAppPhone,
                                }),
                              });
                              const result = await response.json();
                              if (!response.ok) throw new Error(result.error || 'No se pudo enviar la respuesta.');
                              
                              // Registrar la respuesta en el historial de chat para este hilo
                              const newSentReply: SentReplyItem = {
                                id: `reply-${Date.now()}`,
                                threadKey: (activeInboxMessage.fromEmail || '').toLowerCase().trim(),
                                text: inboxReplyText,
                                subject: inboxReplySubject || `Re: ${activeInboxMessage.subject}`,
                                date: new Date().toISOString(),
                                includeWhatsApp: replyIncludeWhatsApp,
                              };
                              setSentReplies(prev => {
                                const nextList = [...prev, newSentReply];
                                try {
                                  localStorage.setItem('rifx_outreach_sent_replies', JSON.stringify(nextList.slice(-100)));
                                } catch {}
                                return nextList;
                              });

                              setMessage('✓ Respuesta con diseño oficial enviada con éxito a ' + activeInboxMessage.fromEmail + ' desde ' + sender);
                              setInboxReplyText('');
                              void load();
                            } catch (err) {
                              setMessage(err instanceof Error ? err.message : 'Error al enviar respuesta.');
                            } finally {
                              setSendingInboxReply(false);
                            }
                          }}
                          className="w-full rounded-xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 px-5 py-3.5 text-xs sm:text-sm font-bold text-white shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-40"
                        >
                          {sendingInboxReply ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              <span>Enviando correo con marco oficial...</span>
                            </>
                          ) : (
                            <>
                              <span>✉️</span>
                              <span>Enviar respuesta con diseño al cliente</span>
                            </>
                          )}
                        </button>
                        <p className="mt-2 text-[11px] text-slate-400 text-center">
                          El cliente recibirá la respuesta en su correo manteniendo el hilo de conversación y con el diseño corporativo de Rifx Marketing.
                        </p>
                      </div>

                      {/* Tarjeta de información del mensaje de Nominalia */}
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <span>ℹ️</span>
                            <span>Datos del correo en Nominalia</span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">UID #{activeInboxMessage.uid}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                          <div>
                            <span className="text-slate-400 block">Recibido el:</span>
                            <span className="font-semibold">{activeInboxMessage.date || 'Reciente'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Buzón receptor:</span>
                            <span className="font-mono text-slate-700 truncate block">{sender}</span>
                          </div>
                        </div>
                      </div>

                      {/* Enlace al editor si es prospecto guardado */}
                      {activeInboxMessage.matchedContactId && (
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            Prospecto: <strong>{activeInboxMessage.matchedContactBusiness}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const found = contacts.find(c => c.id === activeInboxMessage.matchedContactId);
                              if (found) {
                                selectContact(found);
                                setActiveTab('editor');
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <span>📋 Abrir propuesta en editor</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* COLUMNA DERECHA: MENSAJE RECIBIDO + VISTA PREVIA EN VIVO */}
                <div className="sticky top-4">
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
                    <div className="space-y-4">
                      {/* Cabecera con selector de vista y selector de dispositivo */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-900">
                            <span>💬</span>
                            <span>Bandeja de Conversación &amp; Vista Previa</span>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                            <button
                              type="button"
                              onClick={() => setInboxRightTab('all')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                                inboxRightTab === 'all'
                                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              ⚡ Ambos
                            </button>
                            <button
                              type="button"
                              onClick={() => setInboxRightTab('client')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                                inboxRightTab === 'client'
                                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              💬 Chat ({activeThread ? activeThread.messages.length : 1})
                            </button>
                            <button
                              type="button"
                              onClick={() => setInboxRightTab('preview')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                                inboxRightTab === 'preview'
                                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              👁️ Vista previa
                            </button>
                          </div>

                          {/* Selector Computadora / Celular como en el editor */}
                          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                            <button
                              type="button"
                              onClick={() => setInboxPreviewSize('desktop')}
                              className={`px-2 py-1 rounded-md font-bold transition ${
                                inboxPreviewSize === 'desktop'
                                  ? 'bg-white text-blue-900 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Vista en computadora"
                            >
                              💻
                            </button>
                            <button
                              type="button"
                              onClick={() => setInboxPreviewSize('mobile')}
                              className={`px-2 py-1 rounded-md font-bold transition ${
                                inboxPreviewSize === 'mobile'
                                  ? 'bg-white text-blue-900 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Vista en celular"
                            >
                              📱
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* BLOQUE 1: BANDEJA DE CHAT DE CONVERSACIÓN (HISTORIAL COMPLETO DE LO ENVIADO Y RECIBIDO) */}
                      {(inboxRightTab === 'all' || inboxRightTab === 'client') && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                          {/* Cabecera del Chat */}
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                              <div className="h-9 w-9 rounded-full bg-blue-700 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                {activeThread?.clientName ? activeThread.clientName.charAt(0).toUpperCase() : '👤'}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                    {activeThread?.clientName || activeInboxMessage.fromName || activeInboxMessage.fromEmail}
                                  </span>
                                  {activeThread?.matchedContactBusiness && (
                                    <span className="rounded bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5">
                                      🏢 {activeThread.matchedContactBusiness}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 font-mono">
                                  {activeThread?.clientEmail || activeInboxMessage.fromEmail}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Hilo activo</span>
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {(activeThread?.messages.length || 1) + sentReplies.filter(r => r.threadKey === activeThread?.threadId).length} intercambios
                              </p>
                            </div>
                          </div>

                          {/* Contenedor de Burbujas de Chat */}
                          <div
                            className={`space-y-3.5 overflow-y-auto pr-1 ${
                              inboxRightTab === 'client' ? 'max-h-[640px]' : 'max-h-[380px]'
                            }`}
                          >
                            {/* 1. Burbuja Inicial: Propuesta enviada por Rifx si existe contacto en CRM */}
                            {activeMatchedContact && (
                              <div className="flex justify-end">
                                <div className="max-w-[85%] rounded-2xl bg-gradient-to-br from-[#103260] to-[#1a4a88] text-white p-3.5 shadow-xs border border-blue-950">
                                  <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-blue-400/20 pb-1">
                                    <span className="text-[10px] font-extrabold text-orange-300 uppercase tracking-wider flex items-center gap-1">
                                      <span>🎯</span>
                                      <span>Propuesta Inicial de Rifx Marketing</span>
                                    </span>
                                    <span className="text-[9px] text-blue-200">
                                      Primer contacto
                                    </span>
                                  </div>
                                  <div className="text-xs text-blue-50 leading-relaxed whitespace-pre-wrap">
                                    {activeMatchedContact.observation || activeMatchedContact.proposal || `Propuesta comercial enviada para potenciar la visibilidad y ventas de ${activeMatchedContact.business || 'tu negocio'}.`}
                                  </div>
                                  <div className="mt-2 text-[9px] text-blue-300/80 flex items-center justify-between">
                                    <span>Enviado desde el módulo comercial Rifx</span>
                                    <span>✓✓ Enviado</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 2. Mensajes del hilo (Entrantes del cliente + Respuestas enviadas por Rifx en orden cronológico) */}
                            {(() => {
                              type TimelineItem = {
                                id: string;
                                isClient: boolean;
                                date: string;
                                sender: string;
                                text: string;
                                subject?: string;
                                uid?: string;
                                includeWhatsApp?: boolean;
                              };

                              const timeline: TimelineItem[] = [];

                              if (activeThread) {
                                for (const m of activeThread.messages) {
                                  timeline.push({
                                    id: `msg-${m.uid}`,
                                    isClient: true,
                                    date: m.date,
                                    sender: activeThread.clientName,
                                    text: m.snippet || '(Sin texto en el mensaje)',
                                    subject: m.subject,
                                    uid: m.uid,
                                  });
                                }
                              }

                              const clientSent = sentReplies.filter(r => r.threadKey === activeThread?.threadId);
                              for (const r of clientSent) {
                                timeline.push({
                                  id: r.id,
                                  isClient: false,
                                  date: r.date,
                                  sender: 'Bryan Arcos • Rifx Marketing',
                                  text: r.text,
                                  subject: r.subject,
                                  includeWhatsApp: r.includeWhatsApp,
                                });
                              }

                              timeline.sort((a, b) => {
                                const tA = new Date(a.date).getTime() || 0;
                                const tB = new Date(b.date).getTime() || 0;
                                return tA - tB;
                              });

                              return timeline.map(item => {
                                if (item.isClient) {
                                  return (
                                    <div key={item.id} className="flex justify-start">
                                      <div className="max-w-[85%] rounded-2xl bg-white border border-slate-200/90 p-3.5 shadow-2xs">
                                        <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-slate-100 pb-1">
                                          <div className="flex items-center gap-1.5">
                                            <span className="h-5 w-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                                              {item.sender.charAt(0).toUpperCase()}
                                            </span>
                                            <span className="text-xs font-bold text-slate-900 truncate">
                                              {item.sender}
                                            </span>
                                          </div>
                                          <span className="text-[10px] text-slate-400 font-medium">
                                            {formatInboxDate(item.date)}
                                          </span>
                                        </div>
                                        {item.subject && (
                                          <div className="mb-1.5">
                                            <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md truncate max-w-full">
                                              {item.subject}
                                            </span>
                                          </div>
                                        )}
                                        <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                                          {item.text}
                                        </div>
                                        <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const quote = `> "${item.text.trim()}"\n\n`;
                                              setInboxReplyText(prev => prev.includes(quote) ? prev : quote + prev);
                                            }}
                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 hover:underline"
                                            title="Citar este mensaje específico en el cuadro de respuesta"
                                          >
                                            <span>✍️</span>
                                            <span>Citar en mi respuesta</span>
                                          </button>
                                          {item.uid && (
                                            <button
                                              type="button"
                                              disabled={deletingInbox}
                                              onClick={() => setDeleteConfirmModal({
                                                uids: [item.uid!],
                                                description: `este mensaje específico de ${item.sender}`,
                                              })}
                                              className="text-slate-300 hover:text-red-500 p-0.5 rounded transition"
                                              title="Eliminar sólo este correo de Nominalia"
                                            >
                                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div key={item.id} className="flex justify-end">
                                      <div className="max-w-[85%] rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-3.5 shadow-2xs">
                                        <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-white/20 pb-1">
                                          <span className="text-xs font-bold text-white flex items-center gap-1">
                                            <span>👑</span>
                                            <span>Tú ({item.sender})</span>
                                          </span>
                                          <span className="text-[10px] text-blue-200">
                                            {formatInboxDate(item.date)}
                                          </span>
                                        </div>
                                        <div className="text-xs text-white leading-relaxed whitespace-pre-wrap">
                                          {item.text}
                                        </div>
                                        <div className="mt-2 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-blue-200">
                                          {item.includeWhatsApp ? (
                                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                                              <WhatsAppIcon className="h-3 w-3" fill="#25D366" />
                                              <span>Botón WhatsApp incluido</span>
                                            </span>
                                          ) : <span />}
                                          <span className="font-semibold text-blue-100 flex items-center gap-1">
                                            <span>✓✓</span>
                                            <span>Enviado con marco oficial</span>
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      {/* BLOQUE 2: VISTA PREVIA EN VIVO DE LA RESPUESTA (CON ALTURA Y DESLIZAMIENTO COMPLETO) */}
                      {(inboxRightTab === 'all' || inboxRightTab === 'preview') && (
                        <div className="rounded-xl border border-slate-200 bg-slate-100 p-2 sm:p-3 overflow-hidden shadow-xs">
                          <div className="mb-2 bg-[#103260] px-3.5 py-2 text-white rounded-lg flex items-center justify-between text-xs font-semibold">
                            <span className="truncate pr-2">Para: {activeInboxMessage.fromEmail}</span>
                            <span className="shrink-0 text-[10px] text-blue-200">Vista previa en vivo</span>
                          </div>
                          <iframe
                            title="Previsualización de Respuesta"
                            srcDoc={
                              renderAgencyReply({
                                subject: inboxReplySubject || (activeInboxMessage.subject.startsWith('Re:') ? activeInboxMessage.subject : `Re: ${activeInboxMessage.subject}`),
                                replyText: inboxReplyText,
                                clientName: activeInboxMessage.fromName,
                                clientBusiness: activeInboxMessage.matchedContactBusiness,
                                originalMessage: activeInboxMessage.snippet,
                                includeWhatsApp: replyIncludeWhatsApp,
                                whatsAppPhone: replyWhatsAppPhone,
                              }).html
                            }
                            className="mx-auto w-full bg-white rounded-lg border border-slate-200 shadow-sm transition-all"
                            style={{
                              height: inboxRightTab === 'all' ? '680px' : '750px',
                              width: inboxPreviewSize === 'mobile' ? 360 : '100%',
                              maxWidth: '100%',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </section>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA 3: ENVÍOS MASIVOS DE PROPUESTAS COMERCIALES (CAMPAÑA)    */}
      {/* ============================================================== */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">

          {/* Encabezado de Campaña Masiva */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-orange-600">Rifx Marketing</span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-semibold text-slate-500">Módulo de Envíos Masivos</span>
              </div>
              <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Campaña Masiva de Propuestas Comerciales
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl">
                Envía tu propuesta formal con marco profesional (cabecera azul marino, franja tomate y botón a WhatsApp) a decenas de prospectos con personalización automática por negocio.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={copyEditorDraftToBulk}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition active:scale-95"
                title="Copia el asunto, precio, propuesta y entregables que tienes en el editor individual"
              >
                <span>📋</span>
                <span>Copiar datos del editor</span>
              </button>

              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold shadow-sm ${
                  smtpReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${smtpReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {smtpReady ? `Nominalia Conectado (${sender})` : 'SMTP Pendiente'}
              </span>
            </div>
          </div>

          {/* Tarjetas de Métricas Rápidas de la Campaña */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Contactos en CRM</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{contacts.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sin enviar (Borradores)</p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {contacts.filter(c => c.delivery_status === 'draft').length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Destinatarios elegidos</p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {bulkMode === 'crm' ? bulkSelectedIds.length : bulkParsedRecipients.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Remitente oficial</p>
              <p className="mt-2 text-xs font-bold text-slate-800 truncate font-mono">{sender}</p>
            </div>
          </div>

          {/* Grid Principal: Configuración a la izquierda, Previsualización y Monitor a la derecha */}
          <div className="grid gap-6 lg:grid-cols-2 items-start">

            {/* ========================================================== */}
            {/* COLUMNA IZQUIERDA: DESTINATARIOS Y REDACCIÓN DE CAMPAÑA   */}
            {/* ========================================================== */}
            <div className="space-y-5">

              {/* TARJETA 1: SELECCIÓN DE DESTINATARIOS */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <span>👥</span>
                    <span>1. Destinatarios de la Campaña</span>
                  </h3>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                    {bulkMode === 'crm' ? `${bulkSelectedIds.length} de ${contacts.length} seleccionados` : `${bulkParsedRecipients.length} correos listos`}
                  </span>
                </div>

                {/* Selector de Modo: CRM vs Pegar Lista */}
                <div className="grid grid-cols-2 gap-2 mb-4 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setBulkMode('crm')}
                    className={`rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      bulkMode === 'crm'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>📇</span>
                    <span>Desde CRM ({contacts.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBulkMode('paste')}
                    className={`rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      bulkMode === 'paste'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>📋</span>
                    <span>Pegar Lista / CSV</span>
                  </button>
                </div>

                {/* MODO CRM: LISTA DE CONTACTOS CON CHECKBOXES */}
                {bulkMode === 'crm' && (
                  <div className="space-y-3">
                    {/* Filtros rápidos y Búsqueda */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={bulkSearch}
                          onChange={e => setBulkSearch(e.target.value)}
                          placeholder="Buscar por negocio o correo..."
                          className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-700"
                        />
                        <span className="absolute left-2.5 top-2 text-xs text-slate-400">🔍</span>
                        {bulkSearch && (
                          <button
                            type="button"
                            onClick={() => setBulkSearch('')}
                            className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-700"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Dropdown Personalizado con Animación y Estilo CRM */}
                      <div ref={bulkFilterDropdownRef} className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setBulkFilterDropdownOpen(prev => !prev)}
                          className={`w-full sm:w-auto inline-flex items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs ${
                            bulkFilterDropdownOpen
                              ? 'border-blue-600 ring-2 ring-blue-600/20 text-blue-900 bg-blue-50/30'
                              : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>
                              {bulkFilterStatus === 'all' && '📂'}
                              {bulkFilterStatus === 'draft' && '📝'}
                              {bulkFilterStatus === 'pending' && '⏳'}
                              {bulkFilterStatus === 'sent' && '✓'}
                            </span>
                            <span>
                              {bulkFilterStatus === 'all' && 'Todos los estados'}
                              {bulkFilterStatus === 'draft' && 'Solo Borradores / Sin enviar'}
                              {bulkFilterStatus === 'pending' && 'Solo Pendientes'}
                              {bulkFilterStatus === 'sent' && 'Ya enviados'}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] text-slate-400 transition-transform duration-200 ${
                              bulkFilterDropdownOpen ? 'rotate-180 text-blue-600 font-bold' : ''
                            }`}
                          >
                            ▼
                          </span>
                        </button>

                        {bulkFilterDropdownOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-64 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-1.5 shadow-2xl ring-1 ring-black/5 z-40 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
                            <div className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                              Filtrar prospectos
                            </div>
                            <div className="space-y-1">
                              {[
                                {
                                  id: 'all',
                                  label: 'Todos los estados',
                                  icon: '📂',
                                  count: contacts.length,
                                  color: 'bg-slate-100 text-slate-700',
                                },
                                {
                                  id: 'draft',
                                  label: 'Solo Borradores / Sin enviar',
                                  icon: '📝',
                                  count: contacts.filter(c => c.delivery_status === 'draft').length,
                                  color: 'bg-amber-100 text-amber-800',
                                },
                                {
                                  id: 'pending',
                                  label: 'Solo Pendientes',
                                  icon: '⏳',
                                  count: contacts.filter(c => c.stage === 'pending').length,
                                  color: 'bg-blue-100 text-blue-800',
                                },
                                {
                                  id: 'sent',
                                  label: 'Ya enviados',
                                  icon: '✓',
                                  count: contacts.filter(c => c.delivery_status === 'sent').length,
                                  color: 'bg-emerald-100 text-emerald-800',
                                },
                              ].map(item => {
                                const active = bulkFilterStatus === item.id;
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                      setBulkFilterStatus(item.id as any);
                                      setBulkFilterDropdownOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-bold transition-all ${
                                      active
                                        ? 'bg-blue-50 text-blue-900 font-extrabold border border-blue-200/60'
                                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">{item.icon}</span>
                                      <span>{item.label}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${item.color}`}>
                                        {item.count}
                                      </span>
                                      {active && <span className="text-blue-700 font-black">✓</span>}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botones de selección masiva */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const filteredIds = contacts
                              .filter(c => {
                                if (bulkFilterStatus === 'draft') return c.delivery_status === 'draft';
                                if (bulkFilterStatus === 'pending') return c.stage === 'pending';
                                if (bulkFilterStatus === 'sent') return c.delivery_status === 'sent';
                                return true;
                              })
                              .filter(c => {
                                if (!bulkSearch) return true;
                                const q = bulkSearch.toLowerCase();
                                return c.business.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
                              })
                              .map(c => c.id);
                            setBulkSelectedIds(Array.from(new Set([...bulkSelectedIds, ...filteredIds])));
                          }}
                          className="font-bold text-blue-700 hover:underline"
                        >
                          ✓ Seleccionar visibles
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={() => {
                            const draftIds = contacts.filter(c => c.delivery_status === 'draft').map(c => c.id);
                            setBulkSelectedIds(draftIds);
                          }}
                          className="font-bold text-amber-700 hover:underline"
                        >
                          Solo borradores ({contacts.filter(c => c.delivery_status === 'draft').length})
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={() => setBulkSelectedIds([])}
                          className="text-slate-500 hover:underline"
                        >
                          Deseleccionar todo
                        </button>
                      </div>

                      <span className="font-bold text-slate-700">
                        {bulkSelectedIds.length} seleccionados
                      </span>
                    </div>

                    {/* Lista con checkboxes */}
                    <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                      {contacts
                        .filter(c => {
                          if (bulkFilterStatus === 'draft') return c.delivery_status === 'draft';
                          if (bulkFilterStatus === 'pending') return c.stage === 'pending';
                          if (bulkFilterStatus === 'sent') return c.delivery_status === 'sent';
                          return true;
                        })
                        .filter(c => {
                          if (!bulkSearch) return true;
                          const q = bulkSearch.toLowerCase();
                          return c.business.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
                        })
                        .map(c => {
                          const isChecked = bulkSelectedIds.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className={`flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer transition ${
                                isChecked ? 'bg-blue-50/50' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setBulkSelectedIds(prev => [...prev, c.id]);
                                    } else {
                                      setBulkSelectedIds(prev => prev.filter(id => id !== c.id));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate">{c.business}</p>
                                  <p className="text-[11px] text-slate-500 font-mono truncate">{c.email}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    c.delivery_status === 'sent'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : c.delivery_status === 'sending'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {delivery[c.delivery_status] || c.delivery_status}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      {contacts.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          No hay contactos guardados en el CRM todavía.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* MODO PEGAR LISTA / CSV */}
                {bulkMode === 'paste' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700">
                        Pega tus correos (uno por línea o con nombre):
                      </label>
                      <span className="text-[11px] text-slate-400 font-mono">
                        correo@negocio.com, Nombre de la Empresa
                      </span>
                    </div>

                    <textarea
                      rows={6}
                      value={bulkPastedText}
                      onChange={e => {
                        setBulkPastedText(e.target.value);
                        handleParsePastedList(e.target.value);
                      }}
                      placeholder={`ventas@mueblesuniversal.com, Muebles Universal\ncontacto@clinicadental.ec, Clínica Dental Guayaquil\ngerencia@restaurantequito.com, Restaurante La Estancia\ninfo@tutienda.com`}
                      className="w-full rounded-xl border border-slate-300 p-3 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 leading-relaxed shadow-inner"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleParsePastedList()}
                        className="rounded-xl bg-slate-800 hover:bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-xs"
                      >
                        <span>⚡</span>
                        <span>Procesar lista</span>
                      </button>

                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={bulkSaveToCrm}
                          onChange={e => setBulkSaveToCrm(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                        />
                        <span>Guardar en el CRM al enviar</span>
                      </label>
                    </div>

                    {/* Resumen de análisis de correos pegados */}
                    {bulkParsedRecipients.length > 0 && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 space-y-1.5">
                        <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                          <span>✓</span>
                          <span>{bulkParsedRecipients.length} destinatarios válidos listos para la campaña</span>
                        </p>
                        {bulkDuplicatesCount > 0 && (
                          <p className="text-[11px] text-emerald-700">
                            • {bulkDuplicatesCount} correo(s) duplicados fueron omitidos automáticamente.
                          </p>
                        )}
                        {bulkInvalidLines.length > 0 && (
                          <p className="text-[11px] text-amber-700">
                            • {bulkInvalidLines.length} línea(s) no contenían un correo válido y fueron descartadas.
                          </p>
                        )}

                        {/* Chips de vista previa de los primeros destinatarios */}
                        <div className="pt-1 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                          {bulkParsedRecipients.map(r => (
                            <span
                              key={r.email}
                              className="inline-flex items-center gap-1 rounded-md bg-white border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                            >
                              <strong className="text-emerald-800">{r.business}:</strong> {r.email}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* TARJETA 2: REDACCIÓN DE LA PROPUESTA MASIVA */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <span>📝</span>
                    <span>2. Contenido de la Propuesta</span>
                  </h3>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <span>Etiqueta:</span>
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-700 font-bold font-mono">
                      &#123;&#123;negocio&#125;&#125;
                    </code>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Asunto del correo masivo</label>
                  <input
                    type="text"
                    value={bulkCampaignDraft.subject}
                    onChange={e => setBulkCampaignDraft(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Ej: Propuesta de marketing y captación para {{negocio}}"
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Se reemplazará automáticamente con el nombre de cada empresa.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Servicio ofrecido</label>
                    <input
                      type="text"
                      value={bulkCampaignDraft.service_title}
                      onChange={e => setBulkCampaignDraft(prev => ({ ...prev, service_title: e.target.value }))}
                      placeholder="Gestión de anuncios publicitarios"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700">Precio / Inversión</label>
                    <input
                      type="text"
                      value={bulkCampaignDraft.price}
                      onChange={e => setBulkCampaignDraft(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="USD 300"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">Entregables del paquete</label>
                    <span className="text-[10px] text-slate-500 font-medium">1 por línea o con viñetas</span>
                  </div>
                  <textarea
                    rows={3}
                    value={bulkCampaignDraft.deliverables}
                    onChange={e => setBulkCampaignDraft(prev => ({ ...prev, deliverables: e.target.value }))}
                    placeholder={'12 piezas gráficas\n3 videos editables\nEstrategia publicitaria'}
                    className={`${inputClass} resize-y leading-relaxed font-sans`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Observación inicial personalizada</label>
                  <textarea
                    rows={2}
                    value={bulkCampaignDraft.observation}
                    onChange={e => setBulkCampaignDraft(prev => ({ ...prev, observation: e.target.value }))}
                    placeholder="Analizamos la presencia comercial de {{negocio}} y sus oportunidades de mercado."
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Cuerpo central de la propuesta</label>
                  <textarea
                    rows={6}
                    value={bulkCampaignDraft.proposal}
                    onChange={e => setBulkCampaignDraft(prev => ({ ...prev, proposal: e.target.value }))}
                    placeholder="Escribe el cuerpo comercial de la propuesta. Recuerda que puedes usar {{negocio}}..."
                    className={`${inputClass} leading-relaxed`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">Nota sobre pauta publicitaria</label>
                  <input
                    type="text"
                    value={bulkCampaignDraft.deliverables_note}
                    onChange={e => setBulkCampaignDraft(prev => ({ ...prev, deliverables_note: e.target.value }))}
                    placeholder="La inversión en anuncios se paga por separado."
                    className={inputClass}
                  />
                </div>

                {/* Configuración de WhatsApp en campaña masiva */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={bulkCampaignDraft.include_whatsapp !== false}
                        onChange={e =>
                          setBulkCampaignDraft(prev => ({
                            ...prev,
                            include_whatsapp: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <WhatsAppIcon className="h-4 w-4" fill="#25D366" />
                        <span>Incluir botón de WhatsApp en la campaña</span>
                      </span>
                    </label>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        bulkCampaignDraft.include_whatsapp !== false
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {bulkCampaignDraft.include_whatsapp !== false ? 'Botón Activo' : 'Omitido'}
                    </span>
                  </div>

                  {bulkCampaignDraft.include_whatsapp !== false && (
                    <div className="pt-2 border-t border-slate-200/80">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Número de WhatsApp (editable)
                      </label>
                      <input
                        type="text"
                        value={bulkCampaignDraft.whatsapp_phone ?? '+593 98 391 0712'}
                        onChange={e =>
                          setBulkCampaignDraft(prev => ({
                            ...prev,
                            whatsapp_phone: e.target.value,
                          }))
                        }
                        placeholder="+593 98 391 0712"
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* TARJETA 3: CONTROLES DE SEGURIDAD Y DISPARO */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <span>🛡️</span>
                    <span>3. Seguridad de Envío y Despacho</span>
                  </h3>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Anti-bloqueo Nominalia
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Intervalo entre correos
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                      {[
                        { ms: 1000, label: '1.0s Rápido' },
                        { ms: 1500, label: '1.5s Recomendado' },
                        { ms: 2500, label: '2.5s Conservador' },
                        { ms: 4000, label: '4.0s Seguro' },
                      ].map(speed => (
                        <button
                          key={speed.ms}
                          type="button"
                          disabled={bulkSending}
                          onClick={() => setBulkDelayMs(speed.ms)}
                          className={`rounded-lg py-1.5 px-2 text-xs font-bold transition-all text-center ${
                            bulkDelayMs === speed.ms
                              ? 'bg-white text-blue-900 shadow-xs font-black'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {speed.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600 leading-relaxed">
                    <span>⏱️</span>
                    <span className="ml-1">
                      El despacho escalonado simula un ritmo humano y evita que el servidor o los filtros antispam restrinjan tu cuenta comercial.
                    </span>
                  </div>
                </div>

                {/* BOTÓN PRINCIPAL DE LANZAMIENTO */}
                <div className="pt-2">
                  {!bulkSending ? (
                    <button
                      type="button"
                      disabled={
                        (bulkMode === 'crm' && bulkSelectedIds.length === 0) ||
                        (bulkMode === 'paste' && bulkParsedRecipients.length === 0) ||
                        !bulkCampaignDraft.subject.trim() ||
                        !bulkCampaignDraft.proposal.trim()
                      }
                      onClick={() => void handleStartBulkSend()}
                      className="w-full rounded-xl bg-[#103260] bg-gradient-to-r from-blue-700 via-[#103260] to-blue-800 p-4 text-center text-sm font-extrabold text-white shadow-md hover:from-blue-800 hover:to-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <span className="text-lg">🚀</span>
                      <span>
                        Iniciar Envío Masivo a{' '}
                        {bulkMode === 'crm' ? bulkSelectedIds.length : bulkParsedRecipients.length} Destinatario(s)
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        bulkStopRef.current = true;
                        setMessage('Deteniendo envío masivo al finalizar el lote actual...');
                      }}
                      className="w-full rounded-xl bg-red-600 p-4 text-center text-sm font-extrabold text-white shadow-md hover:bg-red-700 transition flex items-center justify-center gap-2 animate-pulse"
                    >
                      <span>⏹</span>
                      <span>Detener Envío Masivo en Progreso</span>
                    </button>
                  )}
                </div>
              </section>

            </div>

            {/* ========================================================== */}
            {/* COLUMNA DERECHA: PREVIEW Y CONSOLA DE ENVÍO EN VIVO       */}
            {/* ========================================================== */}
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                
                {/* Switcher Superior de la columna derecha */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkRightTab('preview')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        bulkRightTab === 'preview'
                          ? 'bg-blue-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      👁️ Vista Previa en Vivo
                    </button>

                    <button
                      type="button"
                      onClick={() => setBulkRightTab('monitor')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                        bulkRightTab === 'monitor'
                          ? 'bg-blue-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>📊</span>
                      <span>Monitor de Progreso</span>
                      {bulkSending && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />}
                    </button>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    {bulkRightTab === 'preview' ? 'Actualización en tiempo real' : `${bulkProgress.current} de ${bulkProgress.total}`}
                  </span>
                </div>

                {/* VISTA PREVIA DEL CORREO DE LA CAMPAÑA */}
                {bulkRightTab === 'preview' && (
                  <div className="space-y-3">
                    {/* Selector de destinatario de muestra */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Viendo muestra personalizada para:
                        </span>
                        <p className="text-xs font-extrabold text-slate-800 truncate">
                          {bulkMode === 'crm'
                            ? (contacts.find(c => bulkSelectedIds.includes(c.id))?.business || contacts[0]?.business || 'Empresa Ejemplo')
                            : (bulkParsedRecipients[bulkPreviewIndex]?.business || 'Empresa Ejemplo')}
                          {' '}
                          <span className="text-slate-500 font-normal font-mono">
                            (
                            {bulkMode === 'crm'
                              ? (contacts.find(c => bulkSelectedIds.includes(c.id))?.email || contacts[0]?.email || 'contacto@empresa.com')
                              : (bulkParsedRecipients[bulkPreviewIndex]?.email || 'contacto@empresa.com')}
                            )
                          </span>
                        </p>
                      </div>

                      {bulkMode === 'paste' && bulkParsedRecipients.length > 1 && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={bulkPreviewIndex === 0}
                            onClick={() => setBulkPreviewIndex(prev => Math.max(0, prev - 1))}
                            className="rounded-lg bg-white border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-30"
                          >
                            ◀
                          </button>
                          <span className="text-xs font-mono font-bold text-slate-600 px-1">
                            {bulkPreviewIndex + 1} / {bulkParsedRecipients.length}
                          </span>
                          <button
                            type="button"
                            disabled={bulkPreviewIndex >= bulkParsedRecipients.length - 1}
                            onClick={() => setBulkPreviewIndex(prev => Math.min(bulkParsedRecipients.length - 1, prev + 1))}
                            className="rounded-lg bg-white border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-30"
                          >
                            ▶
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Marco Iframe con diseño oficial */}
                    <div className="rounded-xl border border-slate-300 overflow-hidden bg-slate-100 shadow-sm">
                      <div className="bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 flex items-center justify-between">
                        <span className="truncate pr-2">
                          Asunto: {personalizeProposal(bulkCampaignDraft.subject || '', {
                            business: bulkMode === 'crm'
                              ? (contacts.find(c => bulkSelectedIds.includes(c.id))?.business || contacts[0]?.business || 'Empresa Ejemplo')
                              : (bulkParsedRecipients[bulkPreviewIndex]?.business || 'Empresa Ejemplo')
                          })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Diseño Oficial Rifx</span>
                      </div>
                      <iframe
                        title="Previsualización de correo masivo"
                        srcDoc={
                          renderOutreach(
                            {
                              ...bulkCampaignDraft,
                              business: bulkMode === 'crm'
                                ? (contacts.find(c => bulkSelectedIds.includes(c.id))?.business || contacts[0]?.business || 'Empresa Ejemplo')
                                : (bulkParsedRecipients[bulkPreviewIndex]?.business || 'Empresa Ejemplo'),
                              email: bulkMode === 'crm'
                                ? (contacts.find(c => bulkSelectedIds.includes(c.id))?.email || contacts[0]?.email || 'contacto@empresa.com')
                                : (bulkParsedRecipients[bulkPreviewIndex]?.email || 'contacto@empresa.com'),
                              subject: personalizeProposal(bulkCampaignDraft.subject || '', {
                                business: bulkMode === 'crm'
                                  ? (contacts.find(c => bulkSelectedIds.includes(c.id))?.business || contacts[0]?.business || 'Empresa Ejemplo')
                                  : (bulkParsedRecipients[bulkPreviewIndex]?.business || 'Empresa Ejemplo')
                              }),
                              proposal: personalizeProposal(bulkCampaignDraft.proposal || '', {
                                business: bulkMode === 'crm'
                                  ? (contacts.find(c => bulkSelectedIds.includes(c.id))?.business || contacts[0]?.business || 'Empresa Ejemplo')
                                  : (bulkParsedRecipients[bulkPreviewIndex]?.business || 'Empresa Ejemplo')
                              }),
                              observation: personalizeProposal(bulkCampaignDraft.observation || '', {
                                business: bulkMode === 'crm'
                                  ? (contacts.find(c => bulkSelectedIds.includes(c.id))?.business || contacts[0]?.business || 'Empresa Ejemplo')
                                  : (bulkParsedRecipients[bulkPreviewIndex]?.business || 'Empresa Ejemplo')
                              }),
                            },
                            sender
                          ).html
                        }
                        className="w-full bg-white border-0 h-[560px]"
                      />
                    </div>
                  </div>
                )}

                {/* MONITOR DE PROGRESO Y CONSOLA DE EJECUCIÓN */}
                {bulkRightTab === 'monitor' && (
                  <div className="space-y-4">
                    {/* Barra de progreso */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-800">
                          {bulkSending ? '🚀 Enviando campaña masiva...' : 'Progreso de la Campaña'}
                        </span>
                        <span className="text-blue-700">
                          {bulkProgress.total > 0
                            ? `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}% (${bulkProgress.current} de ${bulkProgress.total})`
                            : 'En espera de inicio'}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-300"
                          style={{
                            width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Contadores de resultados */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Exitosos</span>
                        <p className="text-xl font-black text-emerald-900">{bulkProgress.sent}</p>
                      </div>
                      <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-700">Fallidos</span>
                        <p className="text-xl font-black text-red-900">{bulkProgress.failed}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Pendientes</span>
                        <p className="text-xl font-black text-slate-800">
                          {Math.max(0, bulkProgress.total - bulkProgress.current)}
                        </p>
                      </div>
                    </div>

                    {/* Tabla de Resultados en Vivo */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>Registro de envíos ({bulkResults.length})</span>
                        {bulkResults.some(r => r.status === 'failed') && !bulkSending && (
                          <button
                            type="button"
                            onClick={() => {
                              const failedItems = bulkResults.filter(r => r.status === 'failed');
                              setBulkParsedRecipients(failedItems.map(f => ({ email: f.email, business: f.business, raw: `${f.email}, ${f.business}` })));
                              setBulkMode('paste');
                              setMessage(`Se cargaron ${failedItems.length} destinatarios fallidos para reintentar.`);
                            }}
                            className="text-xs font-bold text-red-700 hover:underline flex items-center gap-1"
                          >
                            <span>🔄</span>
                            <span>Cargar solo fallidos para reintentar</span>
                          </button>
                        )}
                      </div>

                      <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                        {bulkResults.map((res, i) => (
                          <div key={`${res.email}-${i}`} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{res.business}</p>
                              <p className="text-[11px] text-slate-500 font-mono truncate">{res.email}</p>
                              {res.error && (
                                <p className="text-[10px] text-red-600 font-medium mt-0.5 truncate">{res.error}</p>
                              )}
                            </div>

                            <div className="shrink-0">
                              {res.status === 'sent' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  <span>✓</span> Enviado
                                </span>
                              )}
                              {res.status === 'failed' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                                  <span>✕</span> Falló
                                </span>
                              )}
                              {res.status === 'skipped' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                  <span>⚠️</span> Omitido
                                </span>
                              )}
                              {res.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  <span>⏳</span> En cola
                                </span>
                              )}
                            </div>
                          </div>
                        ))}

                        {bulkResults.length === 0 && (
                          <div className="p-8 text-center text-slate-400 text-xs">
                            Los resultados del envío masivo aparecerán aquí en tiempo real una vez que inicies la campaña.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

          </div>

        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA 2: REDACCIÓN (IZQ) Y VISTA PREVIA (DER)                   */}
      {/* ============================================================== */}
      {activeTab === 'editor' && (
      <div className="grid gap-6 lg:grid-cols-2 items-start">

        {/* ------------------------------------------------------------ */}
        {/* COLUMNA IZQUIERDA: FORMULARIO DE REDACCIÓN & CONTACTOS       */}
        {/* ------------------------------------------------------------ */}
        <div className="space-y-5">
          {selected && inboxMessages.some(m => m.matchedContactId === selected.id) && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-950 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-extrabold text-emerald-900 flex items-center gap-1.5">
                  <span>💬</span>
                  <span>¡Este cliente ha respondido a tu propuesta!</span>
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5 line-clamp-1">
                  &quot;{inboxMessages.find(m => m.matchedContactId === selected.id)?.snippet}&quot;
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const msg = inboxMessages.find(m => m.matchedContactId === selected.id);
                  if (msg) {
                    setReplyModal({
                      to: selected.email,
                      contactId: selected.id,
                      business: selected.business,
                      subject: `Re: ${selected.subject}`,
                      replyText: '',
                    });
                  }
                }}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs"
              >
                <span>💬 Responder aquí</span>
              </button>
            </div>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            
            {/* Barra superior de selección de prospecto */}
            <div className="border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {selected ? `Editando: ${selected.business}` : 'Nueva Propuesta'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowContactList(!showContactList)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <span>📋</span>
                    <span>Lista ({contacts.length})</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={startNewContact}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#103260] px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <span>+</span>
                    <span>Nuevo</span>
                  </button>
                </div>
              </div>

              {/* Selector desplegable de negocio con estilo CRM */}
              <div ref={contactSelectDropdownRef} className="relative mt-3">
                <button
                  type="button"
                  onClick={() => setContactSelectDropdownOpen(prev => !prev)}
                  className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs text-left font-medium shadow-xs transition-all ${
                    contactSelectDropdownOpen
                      ? 'border-blue-500 bg-blue-50/40 text-slate-900 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    {selected ? (
                      <>
                        <span className="shrink-0 font-bold text-slate-900">
                          🏢 {selected.business}
                        </span>
                        <span className="text-slate-400 shrink-0">—</span>
                        <span className="text-slate-600 truncate text-[11px]">
                          {selected.email}
                        </span>
                        <span className="shrink-0 rounded-md bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-semibold">
                          {delivery[selected.delivery_status]}
                        </span>
                      </>
                    ) : (
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span className="text-blue-600 font-black">➕</span>
                        <span>[Crear nueva propuesta desde cero]</span>
                      </span>
                    )}
                  </div>
                  <span className={`text-slate-400 text-xs shrink-0 transition-transform duration-200 ${contactSelectDropdownOpen ? 'rotate-180 text-blue-600 font-bold' : ''}`}>
                    ▼
                  </span>
                </button>

                {contactSelectDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-2 shadow-2xl ring-1 ring-black/5 z-50 transition-all duration-200 animate-in fade-in slide-in-from-top-2 max-h-80 overflow-y-auto">
                    {/* Búsqueda rápida dentro del dropdown */}
                    <div className="px-1 pb-2">
                      <input
                        type="text"
                        placeholder="🔍 Filtrar por negocio o correo..."
                        value={contactSelectSearch}
                        onChange={e => setContactSelectSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        onClick={e => e.stopPropagation()}
                      />
                    </div>

                    <div className="space-y-1">
                      {/* Opción Crear nueva propuesta desde cero */}
                      <button
                        type="button"
                        onClick={() => {
                          startNewContact();
                          setContactSelectDropdownOpen(false);
                          setContactSelectSearch('');
                        }}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl p-2.5 text-left text-xs transition-all ${
                          !selected
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'hover:bg-slate-100 text-slate-800 border border-dashed border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={!selected ? 'text-white' : 'text-blue-600 font-bold'}>➕</span>
                          <span className="font-bold">Crear nueva propuesta desde cero</span>
                        </div>
                        {!selected && <span className="text-sm">✓</span>}
                      </button>

                      {/* Lista filtrada de contactos */}
                      {contacts
                        .filter(c => {
                          if (!contactSelectSearch) return true;
                          const q = contactSelectSearch.toLowerCase();
                          return c.business.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
                        })
                        .map(c => {
                          const isSelected = selected?.id === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                selectContact(c);
                                setContactSelectDropdownOpen(false);
                                setContactSelectSearch('');
                              }}
                              className={`w-full flex items-center justify-between gap-3 rounded-xl p-2.5 text-left text-xs transition-all ${
                                isSelected
                                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                                  : 'hover:bg-slate-100 text-slate-800'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold truncate">{c.business}</span>
                                  <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
                                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {delivery[c.delivery_status]}
                                  </span>
                                </div>
                                <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                  {c.email}
                                </p>
                              </div>
                              {isSelected && <span className="text-sm shrink-0">✓</span>}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Desplegable interactivo para explorar/buscar contactos */}
              {showContactList && (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                  <input
                    className={`${inputClass} text-xs mb-2`}
                    placeholder="🔍 Buscar por nombre o correo..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {contacts
                      .filter(c => `${c.business} ${c.email}`.toLowerCase().includes(query.toLowerCase()))
                      .map(contact => (
                        <div
                          key={contact.id}
                          onClick={() => selectContact(contact)}
                          className={`cursor-pointer rounded-lg p-2.5 text-xs flex items-center justify-between transition-all ${
                            selected?.id === contact.id
                              ? 'bg-blue-600 text-white font-bold shadow-sm'
                              : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'
                          }`}
                        >
                          <div>
                            <p className="font-bold">{contact.business}</p>
                            <p className={`text-[11px] ${selected?.id === contact.id ? 'text-blue-100' : 'text-slate-500'}`}>
                              {contact.email}
                            </p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded ${
                            selected?.id === contact.id ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {delivery[contact.delivery_status]}
                          </span>
                        </div>
                      ))}
                    {!contacts.length && (
                      <p className="text-center text-xs text-slate-500 py-3">No hay negocios registrados aún.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Selector de plantilla */}
            <div className="mt-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Plantilla del correo
              </label>
              <div ref={templateDropdownRef} className="relative">
                <button
                  type="button"
                  disabled={locked || busy}
                  onClick={() => setTemplateDropdownOpen(prev => !prev)}
                  className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs text-left font-medium shadow-xs transition-all ${
                    templateDropdownOpen
                      ? 'border-blue-500 bg-blue-50/40 text-slate-900 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    {!draft.template_html ? (
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>⭐</span>
                        <span>Rifx – Azul marino (Profesional oficial)</span>
                      </span>
                    ) : (
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>🎨</span>
                        <span>Diseño personalizado aplicado</span>
                      </span>
                    )}
                  </div>
                  <span className={`text-slate-400 text-xs shrink-0 transition-transform duration-200 ${templateDropdownOpen ? 'rotate-180 text-blue-600 font-bold' : ''}`}>
                    ▼
                  </span>
                </button>

                {templateDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-1.5 shadow-2xl ring-1 ring-black/5 z-50 transition-all duration-200 animate-in fade-in slide-in-from-top-2 max-h-72 overflow-y-auto">
                    <div className="space-y-1">
                      {/* Plantilla oficial */}
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({ ...draft, template_html: null });
                          setTemplateDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-3 rounded-xl p-2.5 text-left text-xs transition-all ${
                          !draft.template_html
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span>⭐</span>
                          <div>
                            <p className="font-bold">Rifx – Azul marino (Profesional oficial)</p>
                            <p className={`text-[10px] ${!draft.template_html ? 'text-blue-100' : 'text-slate-500'}`}>
                              Marco oficial comercial con franja naranja y WhatsApp
                            </p>
                          </div>
                        </div>
                        {!draft.template_html && <span className="text-sm shrink-0">✓</span>}
                      </button>

                      {/* Plantilla personalizada si existe */}
                      {draft.template_html && (
                        <button
                          type="button"
                          onClick={() => setTemplateDropdownOpen(false)}
                          className="w-full flex items-center justify-between gap-3 rounded-xl p-2.5 text-left text-xs bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold"
                        >
                          <div className="flex items-center gap-2">
                            <span>🎨</span>
                            <span>Diseño personalizado aplicado</span>
                          </div>
                          <span className="text-sm">✓</span>
                        </button>
                      )}

                      {/* Otras plantillas guardadas */}
                      {templates.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setDraft({ ...draft, template_html: t.html });
                            setTemplateDropdownOpen(false);
                          }}
                          className="w-full flex items-center justify-between gap-3 rounded-xl p-2.5 text-left text-xs hover:bg-slate-100 text-slate-800 transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span>📄</span>
                            <span className="font-semibold truncate">{t.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion para plantillas HTML avanzadas */}
              <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <summary className="cursor-pointer text-xs font-bold text-slate-600 uppercase tracking-wider hover:text-slate-900">
                  + Opciones avanzadas: Pegar mi propio HTML
                </summary>
                <div className="mt-3 space-y-2.5">
                  <p className="text-xs text-slate-500">
                    Usa las etiquetas <code className="rounded bg-slate-200 px-1 font-mono">{'{{negocio}}'}</code> y{' '}
                    <code className="rounded bg-slate-200 px-1 font-mono">{'{{propuesta}}'}</code>.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Nombre de la plantilla</label>
                    <input
                      disabled={locked || busy}
                      value={templateName}
                      maxLength={100}
                      placeholder="Ej: Campaña Black Friday"
                      className={inputClass}
                      onChange={e => setTemplateName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Cargar archivo .html</label>
                    <input
                      disabled={locked || busy}
                      type="file"
                      accept=".html,.htm,text/html"
                      className="mt-1 block w-full text-xs text-slate-500 file:mr-3 file:rounded file:border-0 file:bg-slate-200 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-300"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        void readTemplateFile(file);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Código HTML</label>
                    <textarea
                      disabled={locked || busy}
                      value={templateCode}
                      maxLength={64_000}
                      rows={4}
                      placeholder="<table ...>...</table>"
                      className={`${inputClass} font-mono text-xs`}
                      onChange={e => setTemplateCode(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={locked || busy || !templateCode.trim()}
                      onClick={useCustomTemplate}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      Probar en vista previa
                    </button>
                    <button
                      type="button"
                      disabled={!ready || locked || busy || !templateName.trim() || !templateCode.trim()}
                      onClick={() => void saveTemplate()}
                      className="rounded-lg bg-[#103260] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
                    >
                      Guardar en biblioteca
                    </button>
                  </div>
                </div>
              </details>
            </div>

            {/* Campos de Redacción en Vivo */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Nombre del Negocio
                <input
                  disabled={locked || busy}
                  maxLength={160}
                  className={inputClass}
                  placeholder="Ej: Muebles Universal"
                  value={draft.business}
                  onChange={e => setDraft({ ...draft, business: e.target.value })}
                />
              </label>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Correo del Negocio
                <input
                  disabled={locked || busy}
                  type="email"
                  maxLength={254}
                  className={inputClass}
                  placeholder="contacto@empresa.com"
                  value={draft.email}
                  onChange={e => setDraft({ ...draft, email: e.target.value })}
                />
              </label>
            </div>

            <label className="mt-3.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
              Asunto del Correo
              <input
                disabled={locked || busy}
                maxLength={200}
                className={inputClass}
                placeholder="Una idea para las cotizaciones de..."
                value={draft.subject}
                onChange={e => setDraft({ ...draft, subject: e.target.value })}
              />
            </label>

            <label className="mt-3.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
              ¿Qué observaste en su negocio? (Personalización)
              <textarea
                disabled={locked || busy}
                rows={3}
                maxLength={1600}
                className={inputClass}
                placeholder="Vi que ofrecen salas personalizadas y retapizado en sus publicaciones..."
                value={draft.observation}
                onChange={e => setDraft({ ...draft, observation: e.target.value })}
              />
            </label>

            {/* Campo de Propuesta con botón Asistente AI */}
            <div className="mt-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Tu propuesta de campaña comercial
                </label>
                <button
                  type="button"
                  disabled={locked || busy}
                  onClick={() => {
                    if (!aiPrompt && draft.observation) {
                      setAiPrompt(`Redacta una propuesta de marketing para ${draft.business || 'este negocio'}. Observación: ${draft.observation}`);
                    }
                    setShowAiModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:from-blue-800 hover:to-indigo-700 transition-all hover:shadow active:scale-95"
                >
                  <span>✨</span>
                  <span>Asistente de escritura AI</span>
                  <span className="rounded bg-emerald-500 px-1.5 py-0.2 text-[9px] font-black uppercase text-white shadow-xs">NEW</span>
                </button>
              </div>
              <textarea
                disabled={locked || busy}
                rows={4}
                maxLength={2400}
                className={inputClass}
                placeholder="Les propongo una campaña orientada a salas personalizadas: destacar acabados..."
                value={draft.proposal}
                onChange={e => setDraft({ ...draft, proposal: e.target.value })}
              />
            </div>

            {/* Sección de Personalización de Oferta, Precio y Muestra de Anuncio */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏷️</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Personalizar Oferta y Anuncio
                  </h3>
                </div>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-extrabold text-blue-900 border border-blue-200">
                  {draft.price || 'USD 300'}
                </span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Precio del servicio
                  </label>
                  <input
                    disabled={locked || busy}
                    maxLength={80}
                    className={inputClass}
                    placeholder="Ej: USD 300, $250, USD 450/mes"
                    value={draft.price ?? 'USD 300'}
                    onChange={e => setDraft({ ...draft, price: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Nombre del servicio / paquete
                  </label>
                  <input
                    disabled={locked || busy}
                    maxLength={160}
                    className={inputClass}
                    placeholder="Ej: Gestión de anuncios publicitarios"
                    value={draft.service_title ?? 'Gestión de anuncios publicitarios'}
                    onChange={e => setDraft({ ...draft, service_title: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Entregables incluidos (1 por línea o con viñetas)
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">Se muestran en lista vertical</span>
                </div>
                <textarea
                  disabled={locked || busy}
                  maxLength={400}
                  rows={3}
                  className={`${inputClass} resize-y leading-relaxed font-sans`}
                  placeholder={'12 piezas gráficas\n3 videos editables\nEstrategia publicitaria'}
                  value={draft.deliverables ?? '12 piezas gráficas • 3 videos editables'}
                  onChange={e => setDraft({ ...draft, deliverables: e.target.value })}
                />
              </div>

              <div className="mt-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Nota sobre inversión publicitaria
                </label>
                <input
                  disabled={locked || busy}
                  maxLength={300}
                  className={inputClass}
                  placeholder="Ej: La inversión en anuncios se paga por separado."
                  value={draft.deliverables_note ?? 'La inversión en anuncios se paga por separado.'}
                  onChange={e => setDraft({ ...draft, deliverables_note: e.target.value })}
                />
              </div>

              {/* Imagen o muestra visual del anuncio desde galería */}
              <div className="mt-3.5 border-t border-slate-200/90 pt-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    📸 Muestra visual del anuncio publicitario (Foto o Mockup)
                  </label>
                  {draft.image_url && (
                    <span className="text-[10px] font-bold text-emerald-700">
                      ✓ Incluida en propuesta
                    </span>
                  )}
                </div>

                {/* Input oculto nativo que abre la galería de fotos del celular o el explorador de archivos */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={locked || busy || uploadingImage}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handleImageFile(file);
                    }
                  }}
                />

                {!draft.image_url ? (
                  /* Zona de carga amigable para subir desde galería */
                  <div
                    onClick={() => {
                      if (!locked && !busy && !uploadingImage) {
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      if (locked || busy || uploadingImage) return;
                      const file = e.dataTransfer.files?.[0];
                      if (file) void handleImageFile(file);
                    }}
                    className={`group relative mt-2 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
                      locked || busy
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                        : 'cursor-pointer border-blue-300 bg-gradient-to-b from-blue-50/50 to-white hover:border-blue-500 hover:bg-blue-50/80 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/25 transition-transform group-hover:scale-105">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="mt-2.5 text-xs font-bold text-slate-900">
                      Toca para subir foto desde tu galería
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 max-w-xs">
                      Selecciona una foto o diseño desde tu galería del celular o archivos (JPG, PNG o WebP hasta 5 MB)
                    </p>
                    <button
                      type="button"
                      disabled={locked || busy || uploadingImage}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
                    >
                      <span>📁 Abrir galería</span>
                    </button>
                  </div>
                ) : (
                  /* Tarjeta cuando ya hay una foto cargada */
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img
                          src={draft.image_url}
                          alt="Vista previa miniatura"
                          className="h-20 w-24 rounded-xl object-cover border border-slate-200 bg-slate-100 shadow-xs"
                          onError={e => {
                            (e.target as HTMLElement).style.opacity = '0.3';
                          }}
                        />
                        {uploadingImage && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/60 text-[10px] font-bold text-white">
                            Subiendo...
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            ✓ Foto lista para el correo
                          </span>
                          {uploadingImage && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 animate-pulse">
                              Guardando...
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-600 line-clamp-2 leading-tight">
                          Esta imagen se adjunta e inserta en la propuesta comercial que ve el cliente.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={locked || busy || uploadingImage}
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
                          >
                            <span>🔄 Cambiar foto</span>
                          </button>
                          <button
                            type="button"
                            disabled={locked || busy}
                            onClick={() => {
                              setDraft({ ...draft, image_url: '' });
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition"
                          >
                            <span>✕ Quitar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Alternativas: link opcional o logo de prueba */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500">
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="text-slate-500 hover:text-slate-800 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>{showUrlInput ? '▼ Ocultar enlace URL' : '🔗 ¿Prefieres pegar un enlace web? (Opcional)'}</span>
                  </button>
                  {!draft.image_url && (
                    <button
                      type="button"
                      disabled={locked || busy}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          image_url: 'https://rifx-marketing.com/images/rifx-logo-user.png',
                        })
                      }
                      className="font-bold text-blue-700 hover:underline"
                    >
                      Usar logo Rifx
                    </button>
                  )}
                </div>

                {showUrlInput && (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Enlace directo a la imagen (URL https://)
                    </label>
                    <input
                      disabled={locked || busy}
                      type="url"
                      maxLength={2000}
                      className={inputClass}
                      placeholder="https://tudominio.com/imagen.jpg"
                      value={draft.image_url?.startsWith('data:') ? '' : draft.image_url ?? ''}
                      onChange={e => setDraft({ ...draft, image_url: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Configuración del Botón de WhatsApp en la Propuesta */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={locked || busy}
                    checked={draft.include_whatsapp !== false}
                    onChange={e => {
                      const enabled = e.target.checked;
                      setDraft(prev => ({ ...prev, include_whatsapp: enabled }));
                      try {
                        localStorage.setItem('rifx_outreach_include_whatsapp', String(enabled));
                      } catch {}
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <WhatsAppIcon className="h-4 w-4" fill="#25D366" />
                    <span>Incluir botón de WhatsApp en la propuesta</span>
                  </span>
                </label>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    draft.include_whatsapp !== false
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {draft.include_whatsapp !== false ? 'Botón Activo' : 'Desactivado (Omitido)'}
                </span>
              </div>

              {draft.include_whatsapp !== false ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Número de WhatsApp (editable)
                    </label>
                    <input
                      disabled={locked || busy}
                      type="text"
                      maxLength={40}
                      value={draft.whatsapp_phone ?? '+593 98 391 0712'}
                      onChange={e => {
                        const val = e.target.value;
                        setDraft(prev => ({ ...prev, whatsapp_phone: val }));
                        try {
                          localStorage.setItem('rifx_outreach_whatsapp_phone', val);
                        } catch {}
                      }}
                      placeholder="+593 98 391 0712"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-2.5 border border-slate-200/60 leading-tight">
                    El botón en el correo se mostrará como <strong>&quot;Chatear por WhatsApp&quot;</strong> con el logo oficial. Al desmarcar esta casilla, el botón y el enlace se quitan por completo de la propuesta.
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-slate-500 leading-normal">
                  El correo se enviará únicamente con la propuesta y tu firma formal, sin el botón ni enlaces directos a WhatsApp.
                </p>
              )}
            </div>

            {/* Advertencia si SMTP no está configurado en local */}
            {!smtpReady && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 shadow-sm">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <span className="text-base">⚠️</span>
                  <span>Servidor de correo (SMTP Nominalia) no configurado en tu entorno local (.env.local)</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800">
                  Como ya configuraste los datos en <strong>Vercel</strong>, en tu web publicada funcionará automáticamente. Para enviar correos desde <strong>localhost</strong> (tu computadora), agrega tus variables en el archivo <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-900">.env.local</code>.
                </p>
              </div>
            )}

            {/* Botones de acción */}
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => void save()}
                disabled={!ready || !valid || locked || busy}
                className="flex-1 rounded-xl bg-[#103260] px-4 py-3 text-xs sm:text-sm font-bold text-white shadow-sm transition-all hover:bg-[#0c264a] disabled:opacity-40"
              >
                💾 Guardar propuesta
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!smtpReady) {
                    setMessage('⚠️ Faltan configurar las credenciales SMTP de Nominalia en .env.local para enviar pruebas.');
                    return;
                  }
                  void send(true);
                }}
                disabled={!ready || !valid || busy}
                className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-bold shadow-sm transition-all ${
                  smtpReady
                    ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-amber-300 bg-amber-50/50 text-amber-800 hover:bg-amber-100/50'
                } disabled:opacity-40`}
                title={!smtpReady ? 'Faltan credenciales de Nominalia en .env.local' : 'Enviar prueba'}
              >
                ✉️ Enviar prueba
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (!smtpReady) {
                    setMessage('⚠️ El envío está bloqueado porque faltan las credenciales SMTP de Nominalia en tu .env.local.');
                    return;
                  }
                  if (!selected || dirty) {
                    await save();
                  }
                  setConfirming(true);
                }}
                disabled={!ready || !valid || locked || busy}
                className={`rounded-xl px-4 py-3 text-xs sm:text-sm font-bold shadow-sm transition-all ${
                  smtpReady
                    ? 'bg-orange-500 text-slate-950 hover:bg-orange-600'
                    : 'bg-amber-400 text-amber-950 hover:bg-amber-500 opacity-80'
                } disabled:opacity-40`}
                title={!smtpReady ? 'Faltan credenciales de Nominalia en .env.local' : 'Enviar al cliente'}
              >
                🚀 Enviar al cliente
              </button>
            </div>

            {/* Modal de confirmación de envío al cliente */}
            {confirming && (
              <div className="mt-4 rounded-xl border-2 border-orange-400 bg-orange-50 p-4 shadow-sm animate-fadeIn">
                <h3 className="text-sm font-extrabold text-orange-950">Confirmar envío de propuesta comercial</h3>
                <p className="mt-1.5 text-xs text-orange-900">
                  <strong>Destinatario:</strong> {draft.email} ({draft.business})
                </p>
                <p className="mt-0.5 text-xs text-orange-900">
                  <strong>Asunto:</strong> {draft.subject}
                </p>
                <p className="mt-1.5 text-[11px] text-orange-800">
                  Se enviará desde <code className="font-bold">{sender}</code> mediante tu servidor SMTP de Nominalia.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => void send(false)}
                    className="rounded-lg bg-[#103260] px-3.5 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Confirmar y Enviar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Seguimiento de CRM comercial */}
            {selected && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Etapa de seguimiento del prospecto
                </label>
                <div ref={stageDropdownRef} className="relative">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStageDropdownOpen(prev => !prev)}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs text-left font-medium shadow-xs transition-all ${
                      stageDropdownOpen
                        ? 'border-blue-500 bg-blue-50/40 text-slate-900 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <span className="font-bold text-slate-900">
                      {stages[selected.stage as keyof typeof stages] || selected.stage}
                    </span>
                    <span className={`text-slate-400 text-xs shrink-0 transition-transform duration-200 ${stageDropdownOpen ? 'rotate-180 text-blue-600 font-bold' : ''}`}>
                      ▼
                    </span>
                  </button>

                  {stageDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-1.5 shadow-2xl ring-1 ring-black/5 z-50 transition-all duration-200 animate-in fade-in slide-in-from-top-2 max-h-60 overflow-y-auto">
                      <div className="space-y-1">
                        {Object.entries(stages).map(([key, label]) => {
                          const isCurrent = selected.stage === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                void setStage(selected, key);
                                setStageDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between gap-3 rounded-xl p-2.5 text-left text-xs transition-all ${
                                isCurrent
                                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                                  : 'hover:bg-slate-100 text-slate-800'
                              }`}
                            >
                              <span>{label}</span>
                              {isCurrent && <span className="text-sm">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <span className="mt-1.5 block text-[11px] text-slate-500">
                  Actualiza el estado cuando el cliente responda o agende. &quot;No contactar&quot; suprime el prospecto.
                </span>
              </div>
            )}
          </section>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* COLUMNA DERECHA: VISUALIZACIÓN EN VIVO (STICKY)              */}
        {/* ------------------------------------------------------------ */}
        <div className="sticky top-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <span>👁️</span>
                  <span>Vista previa en tiempo real</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Se actualiza instantáneamente con cada palabra que escribes
                </p>
              </div>

              {/* Alternador de dispositivos */}
              <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                {(['desktop', 'mobile'] as const).map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPreviewSize(size)}
                    className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                      previewSize === size
                        ? 'bg-white text-blue-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {size === 'mobile' ? '📱 Celular' : '💻 Computadora'}
                  </button>
                ))}
              </div>
            </div>

            {/* Marco de visualización del correo */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-2 sm:p-3">
              <iframe
                title="Vista previa de la propuesta"
                sandbox=""
                srcDoc={preview}
                className="mx-auto h-[680px] lg:h-[750px] max-w-full rounded-lg border border-slate-200 bg-white shadow-sm transition-all"
                style={{ width: previewSize === 'mobile' ? 360 : '100%' }}
              />
            </div>
          </section>
        </div>

      </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: RESPONDER AL CLIENTE DIRECTAMENTE DESDE EL CRM           */}
      {/* ============================================================== */}
      {replyModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            className="relative flex flex-col w-full max-w-2xl max-h-[92vh] rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-white">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <span>💬</span>
                  <span>Responder a {replyModal.business || replyModal.to}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  El correo se enviará oficialmente desde <strong className="text-slate-800">{sender}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyModal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Cerrar"
              >
                <span className="text-xl leading-none font-bold">✕</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Destinatario
                </label>
                <input
                  disabled
                  className={`${inputClass} bg-slate-100 text-slate-600 cursor-not-allowed`}
                  value={replyModal.to}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Asunto del correo
                </label>
                <input
                  disabled={sendingReply}
                  className={inputClass}
                  value={replyModal.subject}
                  onChange={e => setReplyModal({ ...replyModal, subject: e.target.value })}
                />
              </div>

              {/* Plantillas de respuesta rápida (Predeterminadas y Personalizadas) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <span>⚡</span>
                    <span>Respuestas rápidas de 1 clic:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewQuickReplyModal({ open: true, title: '', text: '' })}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-2 py-0.5 text-[11px] transition shadow-2xs"
                    title="Crear y guardar una nueva respuesta personalizada"
                  >
                    <span>+</span>
                    <span>Nueva respuesta</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickReplies.map(qr => (
                    <button
                      key={qr.id}
                      type="button"
                      onClick={() => {
                        const name = replyModal.business || '';
                        const filled = (qr.text || '')
                          .replace(/\{\{nombre\}\}/g, name)
                          .replace(/\{nombre\}/g, name);
                        setReplyModal({ ...replyModal, replyText: filled });
                      }}
                      className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition shadow-2xs"
                    >
                      {qr.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Mensaje de respuesta
                  </label>
                  <button
                    type="button"
                    disabled={improvingReplyWithAi || sendingReply}
                    onClick={() => {
                      void handleImproveReplyWithAi({
                        draftText: replyModal.replyText,
                        clientBusiness: replyModal.business,
                        onSuccess: improved => setReplyModal({ ...replyModal, replyText: improved }),
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-700 hover:from-purple-700 hover:to-blue-800 text-white px-2.5 py-1 text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-40"
                    title="Mejora la redacción y persuasión del mensaje con IA"
                  >
                    {improvingReplyWithAi ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Mejorando...</span>
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        <span>Mejorar con IA</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={6}
                  disabled={sendingReply || improvingReplyWithAi}
                  value={replyModal.replyText}
                  onChange={e => setReplyModal({ ...replyModal, replyText: e.target.value })}
                  placeholder="Escribe aquí tu respuesta para el cliente..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 leading-relaxed resize-none"
                />
              </div>

              {/* Configuración de WhatsApp */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={replyIncludeWhatsApp}
                      onChange={e => {
                        setReplyIncludeWhatsApp(e.target.checked);
                        try {
                          localStorage.setItem('rifx_reply_include_whatsapp', String(e.target.checked));
                        } catch {}
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <WhatsAppIcon className="h-3.5 w-3.5" fill="#25D366" />
                      <span>Incluir botón de WhatsApp en el correo</span>
                    </span>
                  </label>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      replyIncludeWhatsApp ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {replyIncludeWhatsApp ? 'Activo' : 'Omitido'}
                  </span>
                </div>

                {replyIncludeWhatsApp && (
                  <div className="pt-2 border-t border-slate-200/80">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Número de WhatsApp (editable)
                    </label>
                    <input
                      type="text"
                      value={replyWhatsAppPhone}
                      onChange={e => {
                        setReplyWhatsAppPhone(e.target.value);
                        try {
                          localStorage.setItem('rifx_reply_whatsapp_phone', e.target.value);
                        } catch {}
                      }}
                      placeholder="+593 98 391 0712"
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setReplyModal(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={sendingReply || !replyModal.replyText.trim()}
                onClick={() => void handleSendReply()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition disabled:opacity-40"
              >
                {sendingReply ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Enviando correo al cliente...</span>
                  </>
                ) : (
                  <>
                    <span>✉️</span>
                    <span>Enviar respuesta</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ASISTENTE DE ESCRITURA AI (ESTILO OFICIAL Y PROFESIONAL)  */}
      {/* ============================================================== */}
      {showAiModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-white">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Asistente de escritura AI
                </h2>
                <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  NEW
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Cerrar"
              >
                <span className="text-xl leading-none font-bold">✕</span>
              </button>
            </div>

            {/* Body Modal (2 Columns) */}
            <div className="grid flex-1 grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-y-auto">
              
              {/* Columna Izquierda: Instrucciones */}
              <div className="flex flex-col justify-between p-5 sm:p-6 space-y-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="text-xs font-bold text-slate-800">
                      Instrucciones
                    </label>
                    <span className="text-xs text-slate-400 cursor-help" title="Describe brevemente qué servicio ofreces y qué incluye tu paquete">ⓘ</span>
                  </div>
                  <textarea
                    rows={8}
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="escribe un mensaje de marketing a este comercial ofreciéndole un servicio donde puedo gestionar sus redes para aumentar sus ventas y que su negocio sea más visible para las personas... en el servicio viene 12 imágenes de post 3 videos que se editan los videos los tendrán que enviar ellos y pagar lo de la campaña publicitaria"
                    className="w-full rounded-xl border border-slate-300 p-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 leading-relaxed resize-none"
                  />

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Estilo ⓘ
                      </label>
                      <select
                        value={aiStyle}
                        onChange={e => setAiStyle(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 font-medium"
                      >
                        <option value="Profesional">Profesional</option>
                        <option value="Persuasivo y vendedor">Persuasivo y vendedor</option>
                        <option value="Directo y conciso">Directo y conciso</option>
                        <option value="Cercano y amigable">Cercano y amigable</option>
                        <option value="Consultivo y estratégico">Consultivo y estratégico</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Idioma ⓘ
                      </label>
                      <select
                        value={aiLanguage}
                        onChange={e => setAiLanguage(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 font-medium"
                      >
                        <option value="Spanish (Español)">Spanish (Español)</option>
                        <option value="English (Inglés)">English (Inglés)</option>
                      </select>
                    </div>
                  </div>

                  {/* Ejemplos interactivos */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-blue-700 font-bold">💡 Ver ejemplos:</span>
                    {AI_EXAMPLES.map((ex, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAiPrompt(ex.text)}
                        className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
                      >
                        {ex.title.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={aiGenerating || !aiPrompt.trim()}
                    onClick={() => void generateAiProposal()}
                    className="w-full rounded-xl bg-blue-700 hover:bg-blue-800 px-4 py-3 text-xs sm:text-sm font-bold text-white shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {aiGenerating ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Redactando propuesta profesional con IA...</span>
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        <span>{aiResult ? 'Generar de nuevo' : 'Generar propuesta'}</span>
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-[10px] text-slate-400 text-center leading-tight">
                    100% IA europea — tu modelo propio, tus datos siguen siendo tuyos. Los resultados pueden necesitar pequeños ajustes.
                  </p>
                </div>
              </div>

              {/* Columna Derecha: Resultado & Draft Ready */}
              <div className="flex flex-col justify-between p-5 sm:p-6 bg-slate-50/50 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                      aiResult
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : aiGenerating
                        ? 'bg-blue-100 text-blue-800 border border-blue-300 animate-pulse'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${aiResult ? 'bg-emerald-500' : aiGenerating ? 'bg-blue-500' : 'bg-slate-400'}`} />
                      {aiResult ? 'DRAFT READY' : aiGenerating ? 'REDACTANDO...' : 'LISTO PARA REDACTAR'}
                    </span>

                    {aiResult?.subject && (
                      <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[200px]" title={aiResult.subject}>
                        Asunto: {aiResult.subject}
                      </span>
                    )}
                  </div>

                  {/* Caja de contenido redactado */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 h-[320px] sm:h-[350px] overflow-y-auto text-xs sm:text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap select-text shadow-inner">
                    {aiResult ? (
                      aiResult.full_draft || aiResult.proposal
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-4">
                        <span className="text-3xl mb-2">✍️</span>
                        <p className="font-bold text-slate-600 text-sm">Tu redacción comercial aparecerá aquí</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs">
                          Escribe lo que ofreces en la columna izquierda y presiona &quot;Generar propuesta&quot; para estructurarlo con IA.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Barra de acciones inferior */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                  {/* Feedback */}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Dar feedback</span>
                    <button
                      type="button"
                      onClick={() => setAiFeedback('up')}
                      className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${aiFeedback === 'up' ? 'text-blue-700 font-bold bg-blue-100' : ''}`}
                      title="Me gustó la redacción"
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiFeedback('down')}
                      className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${aiFeedback === 'down' ? 'text-amber-700 font-bold bg-amber-100' : ''}`}
                      title="Podría mejorar"
                    >
                      👎
                    </button>
                    {aiFeedback && <span className="text-[10px] text-emerald-600 font-bold">¡Gracias!</span>}
                  </div>

                  {/* Botón Añadir al Correo */}
                  <div className="relative">
                    <div className="inline-flex rounded-xl shadow-sm">
                      <button
                        type="button"
                        disabled={!aiResult}
                        onClick={() => applyAiToEmail('all')}
                        className="rounded-l-xl bg-blue-700 hover:bg-blue-800 px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition-all disabled:opacity-40"
                      >
                        Añadir al correo
                      </button>
                      <button
                        type="button"
                        disabled={!aiResult}
                        onClick={() => setAiDropdownOpen(!aiDropdownOpen)}
                        className="rounded-r-xl border-l border-blue-600 bg-blue-700 hover:bg-blue-800 px-2.5 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-40"
                        aria-label="Más opciones"
                      >
                        ▾
                      </button>
                    </div>

                    {aiDropdownOpen && (
                      <div className="absolute right-0 bottom-full mb-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-20 animate-in fade-in zoom-in-95">
                        <button
                          type="button"
                          onClick={() => {
                            setAiDropdownOpen(false);
                            applyAiToEmail('all');
                          }}
                          className="w-full text-left rounded-lg p-2 text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-900"
                        >
                          ✨ Aplicar todo al correo (recomendado)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAiDropdownOpen(false);
                            applyAiToEmail('proposal_only');
                          }}
                          className="w-full text-left rounded-lg p-2 text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-900"
                        >
                          📝 Aplicar solo el texto de propuesta
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAiDropdownOpen(false);
                            applyAiToEmail('copy');
                          }}
                          className="w-full text-left rounded-lg p-2 text-xs font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-900"
                        >
                          📋 Copiar texto al portapapeles
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar de Nominalia */}
      {deleteConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-xl shrink-0">
                🗑️
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  ¿Eliminar de Nominalia?
                </h3>
                <p className="text-xs text-slate-500">
                  Liberación física de almacenamiento
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Se eliminará permanentemente <strong className="text-slate-900 font-bold">{deleteConfirmModal.description}</strong> directamente del servidor de correo de Nominalia (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">{sender}</code>).
            </p>

            <div className="mt-3.5 rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900 leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1">
                <span>💡</span>
                <span>Evita que se llene la memoria</span>
              </div>
              <p>
                Al confirmar, se enviará la orden IMAP de purgado (EXPUNGE) a Nominalia para liberar la memoria del buzón de inmediato. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={deletingInbox}
                onClick={() => setDeleteConfirmModal(null)}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={deletingInbox}
                onClick={() => void handleDeleteInbox(deleteConfirmModal.uids)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                {deletingInbox ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Eliminando de Nominalia...</span>
                  </>
                ) : (
                  <>
                    <span>🗑️</span>
                    <span>Sí, eliminar y liberar memoria</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREAR NUEVA RESPUESTA RÁPIDA PERSONALIZADA             */}
      {/* ============================================================== */}
      {newQuickReplyModal.open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Nueva respuesta personalizada
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Guarda una plantilla para contestar prospectos con 1 solo clic.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewQuickReplyModal({ open: false, title: '', text: '' })}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Título del botón
                </label>
                <input
                  type="text"
                  value={newQuickReplyModal.title}
                  onChange={e => setNewQuickReplyModal({ ...newQuickReplyModal, title: e.target.value })}
                  placeholder="Ej: 💼 Enviar catálogo y precios"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Texto del mensaje
                  </label>
                  <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                    Tip: usa &#123;&#123;nombre&#125;&#125; para el cliente
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={newQuickReplyModal.text}
                  onChange={e => setNewQuickReplyModal({ ...newQuickReplyModal, text: e.target.value })}
                  placeholder={`Hola {{nombre}},\n\nCon mucho gusto. Te comparto la información detallada de nuestros planes y resultados...\n\nQuedo a tu disposición.`}
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 leading-relaxed resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setNewQuickReplyModal({ open: false, title: '', text: '' })}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!newQuickReplyModal.title.trim() || !newQuickReplyModal.text.trim()}
                onClick={() => {
                  const title = newQuickReplyModal.title.trim();
                  const text = newQuickReplyModal.text.trim();
                  if (!title || !text) return;
                  const newItem: QuickReplyItem = {
                    id: 'qr_' + Date.now(),
                    title,
                    text,
                  };
                  const updated = [...quickReplies, newItem];
                  setQuickReplies(updated);
                  try {
                    localStorage.setItem('rifx_custom_quick_replies', JSON.stringify(updated));
                  } catch {}
                  setNewQuickReplyModal({ open: false, title: '', text: '' });
                  setMessage('✓ Nueva respuesta rápida personalizada "' + title + '" guardada con éxito.');
                }}
                className="rounded-xl bg-blue-700 hover:bg-blue-800 px-5 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-40"
              >
                Guardar respuesta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return <div className="space-y-5 pt-1">{mainContent}</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 pb-48 text-slate-900 sm:px-8">
      {mainContent}
    </main>
  );
}

