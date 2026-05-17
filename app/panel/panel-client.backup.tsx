'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Settings, 
  LayoutDashboard, 
  MessageSquare, 
  TrendingUp, 
  Save, 
  CheckCircle2, 
  CreditCard,
  User,
  LogOut,
  BrainCircuit,
  Zap,
  Users,
  Clock,
  X,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Bell,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

// Simulación de datos de ventas por IA
const mockSales = [
  { id: 1, customer: 'Ana García', amount: 850, service: 'Diseño Web Inmersivo', time: 'Hace 5 min', status: 'completed' },
  { id: 2, customer: 'Carlos López', amount: 300, service: 'WhatsApp IA', time: 'Hace 45 min', status: 'completed' },
  { id: 3, customer: 'Empresa XYZ', amount: 1200, service: 'Ecommerce Interestelar', time: 'Hace 2 horas', status: 'completed' },
];

// Datos simulados de ingresos por día del mes (Mayo 2026)
const monthlyIncomeData: Record<string, Record<number, number>> = {
  '2026-05': {
    1: 150, 2: 300, 3: 200, 4: 500, 5: 850, 6: 150, 7: 200,
    8: 400, 9: 620, 10: 330, 11: 720, 12: 180, 13: 90, 14: 450,
    15: 310, 16: 560, 17: 280, 18: 670, 19: 420, 20: 350, 21: 510,
    22: 600, 23: 380, 24: 490, 25: 700, 26: 250, 27: 330, 28: 580,
    29: 410, 30: 530, 31: 620,
  },
  '2026-04': {
    1: 100, 2: 220, 3: 310, 4: 180, 5: 450, 6: 270, 7: 390,
    8: 500, 9: 340, 10: 620, 11: 150, 12: 480, 13: 210, 14: 370,
    15: 530, 16: 290, 17: 410, 18: 550, 19: 190, 20: 330, 21: 460,
    22: 580, 23: 120, 24: 350, 25: 690, 26: 230, 27: 410, 28: 520,
    29: 310, 30: 440,
  },
};

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Monday = 0
}

function formatRelativeTime(dateString: string | undefined, lang: string) {
  if (!dateString) return lang === 'es' ? 'Reciente' : 'Recent';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return lang === 'es' ? 'Reciente' : 'Recent';
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return lang === 'es' ? 'Hace unos segundos' : 'A few seconds ago';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return lang === 'es' ? `Hace ${diffInMinutes} min` : `${diffInMinutes} min ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return lang === 'es' ? `Hace ${diffInHours} horas` : `${diffInHours} hours ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return lang === 'es' ? `Hace ${diffInDays} días` : `${diffInDays} days ago`;
}

export default function PanelClient() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerEmail, setRegisterEmail] = useState('');
  
  const [testMessages, setTestMessages] = useState<any[]>([
    { role: 'assistant', content: '¡Hola! Soy el asistente de clasificación. Escribe un mensaje de usuario para ver cómo lo categorizo.' }
  ]);
  const [testInput, setTestInput] = useState('');
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [lastInference, setLastInference] = useState<any>(null);
  const [testHistory, setTestHistory] = useState<any[]>([]);

  // Bot Configuration Playground state
  const [botName, setBotName] = useState('Alpha-One Support');
  const [botRole, setBotRole] = useState('');
  const [botTone, setBotTone] = useState('Profesional');
  const [botTemperature, setBotTemperature] = useState(0.7);
  const [botModelSelected, setBotModelSelected] = useState('gpt-4o');
  const [botHumanHandoff, setBotHumanHandoff] = useState(true);
  const [botProfanityFilter, setBotProfanityFilter] = useState(true);
  const [botTopicLocks, setBotTopicLocks] = useState(false);
  const [botKnowledgeFiles, setBotKnowledgeFiles] = useState<{name: string, type: string, size: string, active: boolean}[]>([
    { name: 'Product_Guide_2024.pdf', type: 'pdf', size: '2.4 MB', active: true },
    { name: 'Customer_FAQs_v1.csv', type: 'csv', size: '540 KB', active: true },
  ]);
  const botKbFileRef = React.useRef<HTMLInputElement>(null);
  const [botPreviewMessages, setBotPreviewMessages] = useState<{role: 'bot' | 'user', content: string, time: string, isKb?: boolean}[]>([
    { role: 'bot', content: '¡Hola! Soy Alpha-One. ¿En qué puedo ayudarte hoy con nuestro portafolio de servicios?', time: '10:12 AM' },
    { role: 'user', content: '¿Puedes explicarme la política de reembolso del plan Pro?', time: '10:13 AM' },
    { role: 'bot', content: 'Según nuestra Guía de Producto, el plan Pro ofrece una garantía de devolución completa de 30 días. ¿Deseas que inicie una solicitud?', time: '10:13 AM', isKb: true },
  ]);
  const [botPreviewInput, setBotPreviewInput] = useState('');

  const [language, setLanguage] = useState('es');

  // Load saved playground config from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('rifx_playground_config');
      if (saved) {
        const cfg = JSON.parse(saved);
        if (cfg.botName) setBotName(cfg.botName);
        if (cfg.botRole) setBotRole(cfg.botRole);
        if (cfg.botTone) setBotTone(cfg.botTone);
        if (cfg.botTemperature !== undefined) setBotTemperature(cfg.botTemperature);
        if (cfg.botHumanHandoff !== undefined) setBotHumanHandoff(cfg.botHumanHandoff);
        if (cfg.botProfanityFilter !== undefined) setBotProfanityFilter(cfg.botProfanityFilter);
        if (cfg.botTopicLocks !== undefined) setBotTopicLocks(cfg.botTopicLocks);
      }
    } catch {}
  }, []);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'crm' | 'settings' | 'playground' | 'segments' | 'analytics' | 'billing'>('dashboard');
  const [currentPlan, setCurrentPlan] = useState<'trial' | 'start' | 'advanced' | 'plus' | 'master'>('trial');
  const [planExpiry, setPlanExpiry] = useState<string>('');
  const [subscriptionData, setSubscriptionData] = useState<any[]>([]);
  const [showPlanConfirm, setShowPlanConfirm] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<{id: string, name: string, status: string, phone_number?: string, created_at?: string} | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualMsg, setManualMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleSendMessage = async () => {
    if ((!manualMsg.trim() && !selectedFile) || sendingMsg) return;
    setSendingMsg(true);
    
    const formData = new FormData();
    formData.append('conversationId', selectedChat?.id || '');
    if (manualMsg.trim()) formData.append('message', manualMsg.trim());
    if (selectedFile) formData.append('file', selectedFile);

    try {
      await fetch('/api/panel/send-message', {
        method: 'POST',
        body: formData,
      });
    } catch (e) {
      console.error(e);
    }

    setManualMsg('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    if (selectedChat?.id) {
      const res = await fetch(`/api/panel/conversations?id=${selectedChat.id}`);
      const data = await res.json();
      if (data.messages) setChatMessages(data.messages);
    }
    setSendingMsg(false);
  };
  const [isHumanMode, setIsHumanMode] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [humanAlerts, setHumanAlerts] = useState<{id: string, name: string, time: string}[]>([]);
  const [showChartModal, setShowChartModal] = useState(false);
  const [calMonth, setCalMonth] = useState(4);
  const [calYear, setCalYear] = useState(2026);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Estados para cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Estados para datos reales
  const [conversationsData, setConversationsData] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [configData, setConfigData] = useState<any>({
    whatsapp_token: '',
    whatsapp_phone_id: '',
    bulk_wa_token: '',
    bulk_wa_phone_id: '',
    openai_key: '',
    gemini_key: '',
    groq_key: '',
    ai_prompt: '',
    panel_password: '',
    media_retention_days: 0,
    admin_name: 'Alexander Thorne',
    admin_email: 'a.thorne@rifx-sovereign.io',
    confidence_threshold: 0.85,
    model_selection: 'Sovereign-Alpha (Default)',
    auto_classification: true,
    email_alerts: true,
    push_notifications: false,
    daily_briefing: true,
  });
  const [showWhatsappKey, setShowWhatsappKey] = useState(false);
  const [showWhatsappPanel, setShowWhatsappPanel] = useState(false);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [bulkSearch, setBulkSearch] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectAllContacts, setSelectAllContacts] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<{id: string, title: string, content: string}[]>([
    { id: '1', title: 'Promoción de Lunes', content: '¡Hola {Nombre}! 🎉 Empezamos la semana con una oferta especial solo para ti. Escríbenos para más info. 🚀' },
    { id: '2', title: 'Seguimiento', content: 'Hola {Nombre}, queríamos saber si pudiste revisar nuestra propuesta. Estamos aquí para ayudarte. 😊' },
    { id: '3', title: 'Recordatorio Demo', content: '¡Hola {Nombre}! Solo un recordatorio de que tienes una demo pendiente con nosotros. ¿Te parece bien agendar? 📅' },
  ]);
  const [templateTitle, setTemplateTitle] = useState('');
  const [sendDelay, setSendDelay] = useState(3);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const bulkMessageRef = React.useRef<HTMLTextAreaElement>(null);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiConfidenceReason, setAiConfidenceReason] = useState('');
  const [isEvaluatingAi, setIsEvaluatingAi] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState<any>({ name: '', phone: '', message: '', countryCode: '+593', testMode: false, testPhone: '' });
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [addContactSuccess, setAddContactSuccess] = useState(false);
  const [tableFilter, setTableFilter] = useState<'all' | 'interested' | 'chatting'>('all');
  const [tableSortBy, setTableSortBy] = useState<'recent' | 'alpha' | 'active'>('recent');
  const [tablePage, setTablePage] = useState(1);
  const [contactScores, setContactScores] = useState<Record<string, {score: number, reason: string}>>({});
  const [isLoadingScores, setIsLoadingScores] = useState(false);
  
  // Chat modal states
  const [chatSearch, setChatSearch] = useState('');
  const [chatSearchIdx, setChatSearchIdx] = useState(-1);
  const [operatorNotes, setOperatorNotes] = useState<{id: string, text: string, createdAt: string}[]>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('rifx_operator_notes') || '[]'); } catch { return []; }
    }
    return [];
  });
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [chatTags, setChatTags] = useState<Record<string, {text: string, color: string}[]>>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('rifx_chat_tags') || '{}'); } catch { return {}; }
    }
    return {};
  });
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [newTagColor, setNewTagColor] = useState('emerald');
  const [detectedEmail, setDetectedEmail] = useState('');
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [showChatNotifications, setShowChatNotifications] = useState(false);
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [selectedAiProvider, setSelectedAiProvider] = useState<'openai' | 'gemini' | 'groq'>('openai');
  const [aiKeyVerifying, setAiKeyVerifying] = useState(false);
  const [aiKeyStatus, setAiKeyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [aiKeyStatusMsg, setAiKeyStatusMsg] = useState('');
  const [showAiApiKey, setShowAiApiKey] = useState(false);
  const [waVerifying, setWaVerifying] = useState(false);
  const [waStatus, setWaStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [waStatusMsg, setWaStatusMsg] = useState('');
  const [memoryClearing, setMemoryClearing] = useState(false);
  const [memoryClearSuccess, setMemoryClearSuccess] = useState(false);
  const [memoryRetentionDays, setMemoryRetentionDays] = useState(30);
  const [memoryUsage, setMemoryUsage] = useState<{totalMessages: number, totalConversations: number, oldestDays: number}>({ totalMessages: 0, totalConversations: 0, oldestDays: 0 });
  const [aiCreditsStatus, setAiCreditsStatus] = useState<'idle' | 'active' | 'low' | 'exhausted' | 'error'>('idle');
  const [aiCreditsMsg, setAiCreditsMsg] = useState('');

  const handleVerifyWhatsApp = async (silentOrEvent: boolean | React.MouseEvent = false) => {
    const silent = typeof silentOrEvent === 'boolean' ? silentOrEvent : false;
    if (!configData.whatsapp_token || !configData.whatsapp_phone_id) {
      if (!silent) {
        setWaStatus('error');
        setWaStatusMsg(language === 'en' ? 'Token and Phone ID are required' : 'El token y el ID de tel\u00E9fono son requeridos');
      }
      return;
    }
    if (!silent) setWaVerifying(true);
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${configData.whatsapp_phone_id}`, {
        headers: { 'Authorization': `Bearer ${configData.whatsapp_token}` }
      });
      const valid = res.ok;
      setWaStatus(valid ? 'success' : 'error');
      setWaStatusMsg(valid 
        ? (language === 'en' ? 'WhatsApp connection verified!' : '\u00A1Conexi\u00F3n de WhatsApp verificada!') 
        : (language === 'en' ? 'Invalid token or Phone ID' : 'Token o ID de tel\u00E9fono inv\u00E1lido'));
    } catch {
      setWaStatus('error');
      setWaStatusMsg(language === 'en' ? 'Network error' : 'Error de red');
    } finally {
      if (!silent) setWaVerifying(false);
    }
  };

  const handleClearMemory = async () => {
    setMemoryClearing(true);
    setMemoryClearSuccess(false);
    try {
      // Clear local conversation cache and test history
      setConversationsData(null);
      setStatsData(null);
      setMemoryClearSuccess(true);
      setTimeout(() => setMemoryClearSuccess(false), 5000);
    } catch {
      // silent fail
    } finally {
      setMemoryClearing(false);
    }
  };

  const handleVerifyAiKey = async (silentOrEvent: boolean | React.MouseEvent = false) => {
    const silent = typeof silentOrEvent === 'boolean' ? silentOrEvent : false;
    const providerMap = { openai: 'openai_key', gemini: 'gemini_key', groq: 'groq_key' } as const;
    const key = configData[providerMap[selectedAiProvider]];
    if (!key || key.trim() === '') {
      if (!silent) {
        setAiKeyStatus('error');
        setAiKeyStatusMsg(language === 'en' ? 'Please enter an API key first' : 'Ingrese una llave API primero');
        setAiCreditsStatus('error');
        setAiCreditsMsg(language === 'en' ? 'No key configured' : 'Sin llave configurada');
      }
      return;
    }
    if (!silent) { setAiKeyVerifying(true); setAiKeyStatus('idle'); }
    try {
      let valid = false;
      let creditsOk = true;
      let creditsMessage = '';
      if (selectedAiProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
        valid = res.ok;
        if (res.status === 429) { creditsOk = false; creditsMessage = language === 'en' ? 'Rate limit reached or credits exhausted' : 'L\u00EDmite alcanzado o cr\u00E9ditos agotados'; }
        else if (valid) {
          // OpenAI doesn't expose credits in headers for /models, show active status
          creditsMessage = language === 'en' ? 'API active \u2022 Key valid \u2022 Pay-as-you-go' : 'API activa \u2022 Llave v\u00E1lida \u2022 Pago por uso';
        }
      } else if (selectedAiProvider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        valid = res.ok;
        if (res.status === 429) { creditsOk = false; creditsMessage = language === 'en' ? 'Quota exceeded' : 'Cuota excedida'; }
        else if (valid) {
          creditsMessage = language === 'en' ? 'API active \u2022 Free tier / Billing active' : 'API activa \u2022 Tier gratuito / Facturaci\u00F3n activa';
        }
      } else if (selectedAiProvider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { 'Authorization': `Bearer ${key}` } });
        valid = res.ok;
        if (res.status === 429) { creditsOk = false; creditsMessage = language === 'en' ? 'Rate limit reached' : 'L\u00EDmite de uso alcanzado'; }
        else if (valid) {
          // Groq exposes rate limit info in headers
          const remaining = res.headers.get('x-ratelimit-remaining-requests');
          const limit = res.headers.get('x-ratelimit-limit-requests');
          const tokensRemaining = res.headers.get('x-ratelimit-remaining-tokens');
          if (remaining && limit) {
            const pct = Math.round((parseInt(remaining) / parseInt(limit)) * 100);
            creditsMessage = language === 'en' 
              ? `${remaining}/${limit} requests remaining (${pct}%)${tokensRemaining ? ` \u2022 ${parseInt(tokensRemaining).toLocaleString()} tokens left` : ''}`
              : `${remaining}/${limit} solicitudes restantes (${pct}%)${tokensRemaining ? ` \u2022 ${parseInt(tokensRemaining).toLocaleString()} tokens disponibles` : ''}`;
            if (pct < 20) { creditsOk = true; setAiCreditsStatus('low'); }
          } else {
            creditsMessage = language === 'en' ? 'API active \u2022 Free tier' : 'API activa \u2022 Tier gratuito';
          }
        }
      }
      setAiKeyStatus(valid ? 'success' : 'error');
      setAiKeyStatusMsg(valid 
        ? (language === 'en' ? 'Connection verified successfully!' : '\u00A1Conexi\u00F3n verificada con \u00E9xito!') 
        : (language === 'en' ? 'Invalid key or connection failed' : 'Llave inv\u00E1lida o conexi\u00F3n fallida'));
      // Update credits status
      if (!creditsOk) {
        setAiCreditsStatus('exhausted');
        setAiCreditsMsg(creditsMessage);
      } else if (valid) {
        if (aiCreditsStatus !== 'low') setAiCreditsStatus('active');
        setAiCreditsMsg(creditsMessage);
      } else {
        setAiCreditsStatus('error');
        setAiCreditsMsg(language === 'en' ? 'Unable to check credits' : 'No se pudo verificar cr\u00E9ditos');
      }
    } catch {
      setAiKeyStatus('error');
      setAiKeyStatusMsg(language === 'en' ? 'Network error - check your connection' : 'Error de red - verifique su conexi\u00F3n');
      setAiCreditsStatus('error');
      setAiCreditsMsg(language === 'en' ? 'Connection failed' : 'Conexi\u00F3n fallida');
    } finally {
      if (!silent) setAiKeyVerifying(false);
    }
  };

  const fetchConversations = () => {
    fetch('/api/panel/conversations')
      .then(res => res.json())
      .then(data => {
        setConversationsData(data);
        checkHumanAlerts(data);
      })
      .catch(console.error);
  };

  const fetchConfig = React.useCallback(() => {
    fetch('/api/panel/config')
      .then(res => res.json())
      .then(data => {
         if (!data.error) {
           setConfigData({
             whatsapp_token: data.whatsapp_token || '',
             whatsapp_phone_id: data.whatsapp_phone_id || '',
             bulk_wa_token: data.bulk_wa_token || '',
             bulk_wa_phone_id: data.bulk_wa_phone_id || '',
             openai_key: data.openai_key || '',
             gemini_key: data.gemini_key || '',
             groq_key: data.groq_key || '',
             payphone_token: data.payphone_token || '',
             payphone_store_id: data.payphone_store_id || '',
             ai_prompt: data.ai_prompt || '',
             panel_password: data.panel_password || '',
             media_retention_days: data.media_retention_days || 0,
             alert_email: data.alert_email || '',
             admin_name: data.admin_name || 'Alexander Thorne',
             admin_email: data.admin_email || 'a.thorne@rifx-sovereign.io',
             confidence_threshold: data.confidence_threshold || 0.85,
             model_selection: data.model_selection || 'Sovereign-Alpha (Default)',
             auto_classification: data.auto_classification !== undefined ? data.auto_classification : true,
             email_alerts: data.email_alerts !== undefined ? data.email_alerts : true,
             push_notifications: data.push_notifications !== undefined ? data.push_notifications : false,
             daily_briefing: data.daily_briefing !== undefined ? data.daily_briefing : true,
           });
         }
      })
      .catch(console.error);
  }, []);

  const discardChanges = () => {
    fetchConfig();
  };

  React.useEffect(() => {
    if (isLoggedIn) {
      // Trigger limpieza silenciosa en background
      fetch('/api/cron/cleanup-media').catch(console.error);

      // Cargar CRM
      fetchConversations();
      
      // Cargar Estadísticas
      fetch('/api/panel/stats')
        .then(res => res.json())
        .then(data => setStatsData(data))
        .catch(console.error);

      // Cargar Config
      fetchConfig();

      // Refrescar cada 10 segundos
      const interval = setInterval(() => {
        fetch('/api/panel/conversations').then(res => res.json()).then(data => {
          setConversationsData(data);
          checkHumanAlerts(data);
        });
        fetch('/api/panel/stats').then(res => res.json()).then(data => setStatsData(data));
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  // Auto-verify API connections when settings tab is opened
  const autoVerifiedRef = React.useRef(false);
  React.useEffect(() => {
    if (activeTab === 'settings' && isLoggedIn && !autoVerifiedRef.current) {
      autoVerifiedRef.current = true;
      // Small delay to ensure config data is loaded
      const timer = setTimeout(() => {
        handleVerifyWhatsApp(true);
        handleVerifyAiKey(true);
      }, 800);
      return () => clearTimeout(timer);
    }
    if (activeTab !== 'settings') {
      autoVerifiedRef.current = false;
    }
  }, [activeTab, isLoggedIn, configData.whatsapp_token, configData.whatsapp_phone_id, selectedAiProvider]);

  // Fetch memory usage when settings tab opens
  React.useEffect(() => {
    if (activeTab === 'settings' && isLoggedIn) {
      fetch('/api/panel/stats').then(r => r.json()).then(data => {
        const totalConvs = data.total || data.conversations || 0;
        const totalMsgs = data.total_messages || data.messages || (totalConvs * 15);
        setMemoryUsage({ totalMessages: totalMsgs, totalConversations: totalConvs, oldestDays: data.oldest_days || 0 });
      }).catch(() => {});
    }
  }, [activeTab, isLoggedIn]);

  // Persist operator notes to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rifx_operator_notes', JSON.stringify(operatorNotes));
    }
  }, [operatorNotes]);

  // Persist chat tags to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rifx_chat_tags', JSON.stringify(chatTags));
    }
  }, [chatTags]);

  // Detect email from chat messages
  React.useEffect(() => {
    if (chatMessages.length > 0) {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      for (const msg of chatMessages) {
        if (msg.role === 'user' && msg.content) {
          const match = msg.content.match(emailRegex);
          if (match) {
            setDetectedEmail(match[0]);
            return;
          }
        }
      }
      setDetectedEmail('');
    }
  }, [chatMessages]);

  // Función para detectar solicitudes de humano en las conversaciones
  const checkHumanAlerts = async (data: any) => {
    if (!data) return;
    const allConvs = [...(data.chatting || []), ...(data.interested || []), ...(data.bought || [])];
    const newAlerts: {id: string, name: string, time: string}[] = [];
    
    for (const conv of allConvs) {
      try {
        const res = await fetch(`/api/panel/conversations?id=${conv.id}`);
        const convData = await res.json();
        if (convData.messages) {
          const hasHumanReq = convData.messages.some((m: any) => m.content === '__HUMAN_REQUEST__');
          // Solo alertar si hay solicitud Y la conversación no está ya en modo humano
          if (hasHumanReq) {
            // Verificar que no hay un __SYSTEM_PAUSE__ más reciente que el __HUMAN_REQUEST__
            const lastHumanReq = [...convData.messages].reverse().findIndex((m: any) => m.content === '__HUMAN_REQUEST__');
            const lastPause = [...convData.messages].reverse().findIndex((m: any) => m.content === '__SYSTEM_PAUSE__');
            if (lastPause === -1 || lastHumanReq < lastPause) {
              newAlerts.push({
                id: conv.id,
                name: conv.customer_name,
                time: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
              });
            }
          }
        }
      } catch (e) {
        // Silenciar errores individuales
      }
    }
    
    setHumanAlerts(newAlerts);
  };

  // Cargar mensajes reales cuando se selecciona un chat
  React.useEffect(() => {
    if (!selectedChat?.id) {
      setChatMessages([]);
      prevMsgCountRef.current = 0;
      return;
    }

    const loadMessages = () => {
      fetch(`/api/panel/conversations?id=${selectedChat.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.messages) {
            // Detectar modo humano desde señales
            const signals = data.messages.filter((m: any) => m.content === '__SYSTEM_PAUSE__' || m.content === '__SYSTEM_RESUME__');
            if (signals.length > 0) {
              setIsHumanMode(signals[signals.length - 1].content === '__SYSTEM_PAUSE__');
            }
            // Filtrar señales para no mostrarlas en el chat
            const visibleMessages = data.messages.filter((m: any) => m.content !== '__SYSTEM_PAUSE__' && m.content !== '__SYSTEM_RESUME__' && m.content !== '__HUMAN_REQUEST__' && m.content !== '__HUMAN_ASK__');
            // Solo actualizar si los mensajes realmente cambiaron
            setChatMessages(prev => {
              const prevLastId = prev.length > 0 ? prev[prev.length - 1]?.id : null;
              const newLastId = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1]?.id : null;
              if (prev.length === visibleMessages.length && prevLastId === newLastId) {
                return prev;
              }
              return visibleMessages;
            });
          }
        })
        .catch(console.error);
    };

    setLoadingMessages(true);
    fetch(`/api/panel/conversations?id=${selectedChat.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.messages) {
          // Detectar modo humano
          const signals = data.messages.filter((m: any) => m.content === '__SYSTEM_PAUSE__' || m.content === '__SYSTEM_RESUME__');
          if (signals.length > 0) {
            setIsHumanMode(signals[signals.length - 1].content === '__SYSTEM_PAUSE__');
          } else {
            setIsHumanMode(false);
          }
          // Filtrar señales
          const visibleMessages = data.messages.filter((m: any) => m.content !== '__SYSTEM_PAUSE__' && m.content !== '__SYSTEM_RESUME__' && m.content !== '__HUMAN_REQUEST__' && m.content !== '__HUMAN_ASK__');
          setChatMessages(visibleMessages);
        }
        setLoadingMessages(false);
      })
      .catch(() => setLoadingMessages(false));

    // Auto-refrescar cada 5 segundos
    const msgInterval = setInterval(loadMessages, 5000);
    return () => clearInterval(msgInterval);
  }, [selectedChat?.id]);

  // Solo hacer scroll al fondo cuando llegan mensajes NUEVOS
  useEffect(() => {
    if (chatMessages.length > 0 && chatMessages.length !== prevMsgCountRef.current) {
      const container = chatContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        const isInitialLoad = prevMsgCountRef.current === 0;
        if (isNearBottom || isInitialLoad) {
          setTimeout(() => {
            container.scrollTop = container.scrollHeight;
          }, 50);
        }
      }
      prevMsgCountRef.current = chatMessages.length;
    }
  }, [chatMessages]);

  // Block body scroll when chat modal is open on mobile
  useEffect(() => {
    if (selectedChat) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedChat]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      // Verificar contraseña contra la DB
      const res = await fetch('/api/panel/config');
      const config = await res.json();
      if (isRegistering) {
        setIsLoggedIn(true);
        setIsRegistering(false);
        return;
      }

      const storedPassword = config.panel_password || 'rifx2026'; // Default si no hay contraseña en DB
      
      if (loginUser === 'admin' && loginPass === storedPassword) {
        setIsLoggedIn(true);
      } else {
        setLoginError('Usuario o contraseña incorrectos');
      }
    } catch {
      // Fallback si no se puede conectar a la DB
      if (loginUser === 'admin' && loginPass === 'rifx2026') {
        setIsLoggedIn(true);
      } else {
        setLoginError('Usuario o contraseña incorrectos');
      }
    }
    setIsLoggingIn(false);
  };

  const handleTestChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim() || isTestingAi) return;

    const userMsg = testInput;
    setTestInput('');
    setTestMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTestingAi(true);

    try {
      const res = await fetch('/api/panel/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg, 
          history: testMessages
        })
      });
      const data = await res.json();
      if (data.response) {
        setTestMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        if (data.inference) {
          setLastInference(data.inference);
          setTestHistory(prev => [{
            message: userMsg,
            inference: data.inference,
            timestamp: new Date().toISOString()
          }, ...prev]);
        }
      }
    } catch (err) {
      console.error("Test AI Error:", err);
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleResetTestChat = () => {
    setTestMessages([
      { role: 'assistant', content: '¡Hola! Soy el asistente de clasificación. Escribe un mensaje de usuario para ver cómo lo categorizo.' }
    ]);
    setLastInference(null);
    setTestInput('');
  };

  // === Bulk Messaging Handlers ===
  const allContacts = React.useMemo(() => {
    return ((conversationsData?.chatting || []).concat(conversationsData?.interested || []).concat(conversationsData?.bought || []));
  }, [conversationsData]);

  // Contacts truly active right now (message activity in the last 1 hour)
  const activeNowContacts = React.useMemo(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return allContacts.filter((c: any) => {
      const lastUpdate = c.updated_at ? new Date(c.updated_at) : null;
      return lastUpdate && lastUpdate > oneHourAgo;
    });
  }, [allContacts]);

  // Table: filtered + sorted contacts
  const ROWS_PER_PAGE = 8;
  const tableContacts = React.useMemo(() => {
    let list = [...allContacts];
    // Filter
    if (tableFilter === 'interested') list = list.filter((c: any) => c.status === 'interested');
    else if (tableFilter === 'chatting') list = list.filter((c: any) => c.status === 'chatting');
    // Sort
    if (tableSortBy === 'alpha') {
      list.sort((a: any, b: any) => (a.customer_name || '').localeCompare(b.customer_name || ''));
    } else if (tableSortBy === 'active') {
      const oneH = Date.now() - 3600000;
      list.sort((a: any, b: any) => {
        const aActive = a.updated_at && new Date(a.updated_at).getTime() > oneH ? 1 : 0;
        const bActive = b.updated_at && new Date(b.updated_at).getTime() > oneH ? 1 : 0;
        return bActive - aActive;
      });
    } else {
      list.sort((a: any, b: any) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
    }
    return list;
  }, [allContacts, tableFilter, tableSortBy]);

  const totalTablePages = Math.max(1, Math.ceil(tableContacts.length / ROWS_PER_PAGE));
  const pagedContacts = tableContacts.slice((tablePage - 1) * ROWS_PER_PAGE, tablePage * ROWS_PER_PAGE);

  // Fetch AI scores for visible contacts
  const fetchContactScores = React.useCallback(async (contacts: any[]) => {
    const ids = contacts.map((c: any) => c.id).filter((id: string) => !contactScores[id]);
    if (ids.length === 0) return;
    setIsLoadingScores(true);
    try {
      const res = await fetch('/api/panel/contact-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: ids })
      });
      const data = await res.json();
      if (data.scores) {
        setContactScores(prev => ({ ...prev, ...data.scores }));
      }
    } catch (err) { console.error(err); }
    finally { setIsLoadingScores(false); }
  }, [contactScores]);

  // Auto-fetch scores when paged contacts change
  React.useEffect(() => {
    if (pagedContacts.length > 0) {
      fetchContactScores(pagedContacts);
    }
  }, [pagedContacts.map((c: any) => c.id).join(',')]); // eslint-disable-line

  const filteredBulkContacts = React.useMemo(() => {
    if (!bulkSearch.trim()) return allContacts;
    const q = bulkSearch.toLowerCase();
    return allContacts.filter((c: any) =>
      (c.customer_name || '').toLowerCase().includes(q) || (c.phone_number || '').includes(q)
    );
  }, [allContacts, bulkSearch]);

  const handleSelectAll = (checked: boolean) => {
    setSelectAllContacts(checked);
    if (checked) {
      setSelectedContacts(new Set(filteredBulkContacts.map((c: any) => c.id)));
    } else {
      setSelectedContacts(new Set());
    }
  };

  const handleToggleContact = (id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleInsertVariable = (variable: string) => {
    const textarea = bulkMessageRef.current;
    if (!textarea) { setBulkMessage(prev => prev + variable); return; }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = bulkMessage.substring(0, start);
    const after = bulkMessage.substring(end);
    setBulkMessage(before + variable + after);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const handleSaveTemplate = () => {
    if (!bulkMessage.trim()) return;
    const title = templateTitle.trim() || `Plantilla ${savedTemplates.length + 1}`;
    setSavedTemplates(prev => [...prev, { id: Date.now().toString(), title, content: bulkMessage }]);
    setTemplateTitle('');
  };

  const handleUseTemplate = (content: string) => {
    setBulkMessage(content);
  };

  const handleDeleteTemplate = (id: string) => {
    setSavedTemplates(prev => prev.filter(t => t.id !== id));
  };

  const handleStartBulkSend = async () => {
    if (selectedContacts.size === 0 || !bulkMessage.trim()) return;
    const contacts = allContacts.filter((c: any) => selectedContacts.has(c.id));
    setIsBulkSending(true);
    setBulkProgress(0);
    setBulkTotal(contacts.length);
    let sentAsTemplate = 0;
    let sentAsText = 0;
    let failedCount = 0;

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      // Replace variables
      let msg = bulkMessage
        .replace(/\{Nombre\}/g, contact.customer_name?.split(' ')[0] || 'Cliente')
        .replace(/\{Apellido\}/g, contact.customer_name?.split(' ').slice(1).join(' ') || '')
        .replace(/\{Empresa\}/g, 'RIFX');

      try {
        const res = await fetch('/api/panel/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: contact.phone_number, message: msg, bulk: true })
        });
        const data = await res.json();
        if (res.ok) {
          if (data.method === 'template') sentAsTemplate++;
          else sentAsText++;
        } else {
          failedCount++;
          console.error(`Error sending to ${contact.phone_number}:`, data.error);
        }
      } catch (err) {
        failedCount++;
        console.error(`Error sending to ${contact.phone_number}:`, err);
      }

      setBulkProgress(i + 1);
      if (i < contacts.length - 1) {
        await new Promise(r => setTimeout(r, sendDelay * 1000));
      }
    }
    setIsBulkSending(false);
    // Show summary
    if (failedCount > 0 || sentAsTemplate > 0) {
      const parts = [];
      if (sentAsText > 0) parts.push(`${sentAsText} enviados`);
      if (sentAsTemplate > 0) parts.push(`${sentAsTemplate} como template (ventana 24h)`);
      if (failedCount > 0) parts.push(`${failedCount} fallidos`);
      alert(`Resultado: ${parts.join(', ')}`);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    // Validaciones
    const storedPassword = configData.panel_password || 'rifx2026';
    if (currentPassword !== storedPassword) {
      setPasswordError('La contraseña actual no es correcta');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/panel/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panel_password: newPassword }),
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setPasswordSuccess(true);
        setConfigData({ ...configData, panel_password: newPassword });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(false), 5000);
      } else {
        setPasswordError(result.error || 'Error al cambiar la contraseña');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Error de conexión');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError('');
    setShowSuccess(false);
    try {
      // Solo enviar campos válidos de la DB
      const payload = {
        whatsapp_token: configData.whatsapp_token,
        whatsapp_phone_id: configData.whatsapp_phone_id,
        openai_key: configData.openai_key,
        gemini_key: configData.gemini_key,
        groq_key: configData.groq_key,
        bulk_wa_token: configData.bulk_wa_token,
        bulk_wa_phone_id: configData.bulk_wa_phone_id,
        payphone_token: configData.payphone_token,
        payphone_store_id: configData.payphone_store_id,
        ai_prompt: configData.ai_prompt,
        media_retention_days: Number(configData.media_retention_days) || 0,
        admin_name: configData.admin_name,
        admin_email: configData.admin_email,
        confidence_threshold: Number(configData.confidence_threshold),
        model_selection: configData.model_selection,
        auto_classification: !!configData.auto_classification,
        email_alerts: !!configData.email_alerts,
        push_notifications: !!configData.push_notifications,
        daily_briefing: !!configData.daily_briefing,
      };
      const res = await fetch('/api/panel/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        setSaveError(result.error || 'Error desconocido al guardar');
        setTimeout(() => setSaveError(''), 8000);
      }
    } catch (err: any) {
      console.error(err);
      setSaveError(err?.message || 'Error de conexión al guardar');
      setTimeout(() => setSaveError(''), 8000);
    } finally {
      setIsSaving(false);
    }
  };

  // ========== LOGIN SCREEN ==========
  if (!isLoggedIn) {
    return (
      <div className="h-screen w-full bg-brand-dark text-white font-sans antialiased overflow-hidden" suppressHydrationWarning>
        <style suppressHydrationWarning>{`
          .hero-bg {
            background-color: #060918;
            background-image:
              radial-gradient(ellipse 80% 60% at 70% 50%, rgba(74,108,247,0.08) 0%, transparent 70%),
              radial-gradient(ellipse 50% 40% at 60% 60%, rgba(147,51,234,0.06) 0%, transparent 70%);
            position: relative;
            overflow: hidden;
          }
          .hero-bg::before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
            background-size: 60px 60px;
            pointer-events: none;
            z-index: 0;
          }
          .wave-container {
            position: absolute;
            top: 50%;
            right: -10%;
            transform: translateY(-50%);
            width: 70%;
            height: 100%;
            z-index: 1;
            pointer-events: none;
          }
          .blob {
            position: absolute;
            border-radius: 50%;
            filter: blur(100px);
            opacity: 0.3;
          }
          .blob-1 {
            width: 500px;
            height: 500px;
            background: linear-gradient(135deg, #4a6cf7, #7c3aed);
            top: 15%;
            right: 5%;
            animation: float 25s infinite alternate;
          }
          .blob-2 {
            width: 400px;
            height: 400px;
            background: linear-gradient(135deg, #06b6d4, #3b82f6);
            bottom: 15%;
            right: 25%;
            animation: float 20s infinite alternate-reverse;
          }
          @keyframes float {
            0% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(30px, -20px) scale(1.05); }
            100% { transform: translate(-20px, 30px) scale(0.95); }
          }
          .glass-input {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .glass-input:focus {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(74, 108, 247, 0.5);
            outline: none;
            box-shadow: 0 0 0 3px rgba(74, 108, 247, 0.1);
          }
          .logo-text {
            letter-spacing: 0.15em;
            font-weight: 800;
            font-family: 'Manrope', sans-serif;
          }
          .welcome-text {
            font-size: 4.5rem;
            line-height: 1;
            font-weight: 800;
            font-family: 'Manrope', sans-serif;
            letter-spacing: -0.02em;
            color: #ffffff;
          }
          .login-btn {
            background: linear-gradient(135deg, #4a6cf7 0%, #7c3aed 100%);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .login-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 30px rgba(74, 108, 247, 0.3);
          }
          .login-btn:active { transform: scale(0.98); }
          .feature-pill {
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.06);
          }
        `}</style>

        {/* MainHeader */}
        <header className="fixed top-0 left-0 right-0 z-50 px-8 py-5 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <span className="logo-text text-base uppercase text-white">RIFX</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
            <a className="hover:text-white transition-colors duration-300" href="#">Acerca de</a>
            <a className="hover:text-white transition-colors duration-300" href="#">Precios</a>
            <a className="hover:text-white transition-colors duration-300" href="#">Contacto</a>
          </nav>
        </header>

        <main className="h-full flex flex-col md:flex-row hero-bg">
          <div className="wave-container">
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>
          </div>

          {/* Left Login Panel */}
          <section className="relative z-10 w-full md:w-[420px] lg:w-[460px] h-full flex flex-col justify-center px-10 md:px-14 border-r border-white/[0.04]" style={{background: 'rgba(6,9,24,0.6)', backdropFilter: 'blur(40px)'}}>
            <div className="mb-10">
              <h2 className="text-2xl font-extrabold text-white mb-1" style={{fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.01em'}}>
                {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesion'}
              </h2>
              <p className="text-gray-500 text-sm">
                {isRegistering ? 'Completa los datos para registrarte' : 'Ingresa tus credenciales para continuar'}
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {isRegistering && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Correo</label>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-600 group-focus-within:text-brand-blue transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    </span>
                    <input 
                      type="email" 
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm text-white placeholder-gray-600 focus:ring-0" 
                      placeholder="correo@ejemplo.com" 
                      required={isRegistering}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Usuario</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-600 group-focus-within:text-brand-blue transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                  </span>
                  <input 
                    type="text" 
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm text-white placeholder-gray-600 focus:ring-0" 
                    placeholder="admin" 
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Contrasena</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-600 group-focus-within:text-brand-blue transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  </span>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    className="w-full pl-11 pr-12 py-3 rounded-xl glass-input text-sm text-white placeholder-gray-600 focus:ring-0" 
                    placeholder="Tu contrasena" 
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-600 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {loginError && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-400 text-xs flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 py-2.5 rounded-xl"
                  >
                    <X className="w-3 h-3" /> {loginError}
                  </motion.p>
                )}
              </AnimatePresence>

              <button 
                type="submit" 
                disabled={isLoggingIn}
                className="w-full py-3.5 login-btn text-white rounded-xl font-bold uppercase tracking-wider text-sm disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isLoggingIn ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (isRegistering ? 'REGISTRARSE' : 'INGRESAR')}
              </button>

              <div className="flex items-center justify-between text-[10px] tracking-wider text-gray-500 uppercase pt-1">
                {!isRegistering ? (
                  <>
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input type="checkbox" className="rounded-sm bg-transparent border-gray-700 text-brand-blue focus:ring-brand-blue/30 focus:ring-offset-0 w-3.5 h-3.5" />
                      <span className="group-hover:text-gray-300 transition-colors">Recordarme</span>
                    </label>
                    <a href="#" className="hover:text-gray-300 transition-colors">Recuperar acceso</a>
                  </>
                ) : (
                  <button type="button" onClick={() => setIsRegistering(false)} className="hover:text-white transition-colors w-full text-center">
                    Ya tengo una cuenta
                  </button>
                )}
              </div>
            </form>

            <div className="mt-10 pt-6 border-t border-white/[0.04]">
              <div className="flex items-center gap-3 text-[10px] text-gray-600 uppercase tracking-wider">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                Conexion segura con cifrado de extremo a extremo
              </div>
            </div>
          </section>

          {/* Right Welcome Panel */}
          <section className="relative z-10 hidden md:flex flex-1 flex-col justify-center items-start px-16 lg:px-24">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-[2px] bg-brand-blue rounded-full"></div>
                <span className="text-brand-blue text-xs font-bold uppercase tracking-widest">Panel de Control</span>
              </div>
              <h1 className="welcome-text mb-6">Bienvenido.</h1>
              <p className="text-gray-400 leading-relaxed max-w-md text-base mb-10">
                Accede a tu centro de inteligencia. Gestiona conversaciones, analiza datos y controla tu asistente de IA desde un solo lugar.
              </p>
              <div className="flex flex-wrap gap-3 mb-10">
                <div className="feature-pill rounded-full px-4 py-2 flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                  Analytics en tiempo real
                </div>
                <div className="feature-pill rounded-full px-4 py-2 flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                  CRM inteligente
                </div>
                <div className="feature-pill rounded-full px-4 py-2 flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                  IA Avanzada
                </div>
              </div>
              <div className="text-sm text-gray-500">
                No tienes cuenta? <button type="button" onClick={() => setIsRegistering(true)} className="text-brand-blue font-semibold hover:text-white transition-colors">Registrate ahora</button>
              </div>
            </div>
          </section>

          <div className="md:hidden p-8 text-center text-xs text-gray-500 uppercase tracking-widest relative z-10 mt-auto">
            No tienes cuenta? <button type="button" onClick={() => setIsRegistering(true)} className="text-brand-blue font-semibold ml-1">Registrate</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
    <div className={`min-h-screen ${language === 'es' ? 'lang-es' : 'lang-en'} bg-crm-surface text-on-surface overflow-x-hidden font-inter`}>
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-transparent bg-[#f3f4f5] flex flex-col py-6 px-4 gap-8 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-50">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-white shadow-lg">
            <span className="material-symbols-outlined">psychology</span>
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#000080] leading-tight font-headline">Sovereign</h2>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Intelligence v1.0</p>
          </div>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          <button onClick={() => setActiveTab('dashboard')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'dashboard' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined">dashboard</span>
            <span>{language === 'en' ? 'Dashboard' : 'Panel Principal'}</span>
          </button>
          <button onClick={() => setActiveTab('crm')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'crm' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>group</span>
            <span>{language === 'en' ? 'Users' : 'Usuarios'}</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'settings' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined">settings</span>
            <span>{language === 'en' ? 'Settings' : 'Configuraciones'}</span>
          </button>
          <button onClick={() => setActiveTab('billing')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'billing' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined">payments</span>
            <span>{language === 'en' ? 'Plans & Billing' : 'Pagos'}</span>
          </button>
        
          <button onClick={() => setActiveTab('playground')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'playground' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined">smart_toy</span>
            <span>{language === 'en' ? 'AI Playground' : 'Playground IA'}</span>
          </button>
          <button onClick={() => setActiveTab('segments')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'segments' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined">pie_chart</span>
            <span>{language === 'en' ? 'Segments' : 'Segmentos'}</span>
          </button>
          <button onClick={() => setActiveTab('analytics')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'analytics' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined">monitoring</span>
            <span>{language === 'en' ? 'Analytics' : 'Análisis'}</span>
          </button>
</nav>
        <div className="mt-auto flex flex-col gap-4">
          <div className="pt-4 border-t border-slate-200/50 flex flex-col gap-1">
            <button onClick={() => setIsLoggedIn(false)} className="flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-error transition-colors text-sm w-full text-left">
              <span className="material-symbols-outlined text-lg">logout</span>
              {language === 'en' ? 'Logout' : 'Cerrar Sesión'}
            </button>
          </div>
        </div>
      </aside>

      {/* TopAppBar */}
      <header className="fixed top-0 right-0 left-64 flex justify-between items-center px-8 h-16 bg-slate-50 border-b border-slate-100/10 z-40">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-full max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input className="w-full bg-crm-surface-container-low border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary-container/20 transition-all text-black" placeholder={language === 'en' ? 'Search audience or segments...' : 'Buscar audiencia o segmentos...'} type="text" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          {/* Notification Bell for Human Requests */}
          <div className="relative group cursor-pointer" onClick={() => {
            if (humanAlerts.length > 0) {
              // Si hay alertas, podríamos abrir el chat del primero o mostrar un mini panel
              const first = humanAlerts[0];
              setSelectedChat({ id: first.id, name: first.name, status: 'chatting', phone_number: '', created_at: '' });
              setTableFilter('all');
            }
          }}>
            <div className={`p-2 rounded-full transition-all ${humanAlerts.length > 0 ? 'bg-red-50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
              <span className={`material-symbols-outlined text-xl ${humanAlerts.length > 0 ? 'animate-swing' : ''}`} style={humanAlerts.length > 0 ? { animation: 'swing 2s infinite ease-in-out' } : {}}>
                notifications
              </span>
            </div>
            {humanAlerts.length > 0 && (
              <>
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                
                {/* Tooltip con nombres */}
                <div className="absolute top-full mt-2 right-0 w-64 bg-white shadow-2xl rounded-2xl border border-slate-100 p-4 opacity-0 group-hover:opacity-100 transition-all pointer-events-auto z-50 transform origin-top-right scale-95 group-hover:scale-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language === 'es' ? 'Solicitudes Humano' : 'Human Requests'}</p>
                    <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{humanAlerts.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {humanAlerts.slice(0, 5).map(alert => (
                      <div 
                        key={alert.id} 
                        className="flex justify-between items-center hover:bg-red-50/50 p-2 rounded-xl transition-all cursor-pointer group/item border border-transparent hover:border-red-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedChat({ id: alert.id, name: alert.name, status: 'chatting', phone_number: '', created_at: '' });
                          // También asegurarnos de que la tabla no esté filtrada si el usuario no aparece
                          setTableFilter('all');
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="text-xs font-bold text-slate-700 group-hover/item:text-primary truncate max-w-[120px]">{alert.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400">{alert.time}</p>
                          <p className="text-[8px] text-primary font-medium opacity-0 group-hover/item:opacity-100 transition-opacity uppercase">{language === 'es' ? 'Ver chat' : 'View chat'}</p>
                        </div>
                      </div>
                    ))}
                    {humanAlerts.length > 5 && (
                      <p className="text-[10px] text-center text-slate-400 pt-2 border-t border-slate-50 mt-2">
                        {language === 'es' ? `y ${humanAlerts.length - 5} más...` : `and ${humanAlerts.length - 5} more...`}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Language Toggle Icon */}
          <button 
            onClick={() => setLanguage(language === 'en' ? 'es' : 'en')} 
            className="relative group p-2 rounded-full bg-slate-100 text-slate-500 hover:bg-primary-container/10 hover:text-primary-container transition-all"
            title={language === 'en' ? 'Cambiar a Español' : 'Switch to English'}
          >
            <span className="material-symbols-outlined text-xl">translate</span>
            <span className="absolute -bottom-0.5 -right-0.5 text-[8px] font-black bg-primary-container text-white rounded-full w-4 h-4 flex items-center justify-center border border-white">
              {language === 'en' ? 'ES' : 'EN'}
            </span>
            {/* Tooltip */}
            <div className="absolute top-full mt-2 right-0 bg-slate-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50">
              {language === 'en' ? 'Cambiar a Español' : 'Switch to English'}
            </div>
          </button>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold text-primary">Admin</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Administrator</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-white border-2 border-white shadow-sm">
               <span className="material-symbols-outlined">admin_panel_settings</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="ml-64 pt-24 pb-12 px-10 relative overflow-y-auto h-screen">
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Hero Stats & Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
              <div className="max-w-2xl">
                <h2 className="text-4xl font-extrabold tracking-tighter text-primary font-headline mb-2">Operational Command</h2>
                <p className="text-slate-500 leading-relaxed max-w-lg">Manage your automated WhatsApp ecosystem. Coordinate lead classification and bulk interactions through Sovereign's neural orchestration.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowWhatsappPanel(!showWhatsappPanel)}
                  className={`px-6 py-3 font-bold text-xs rounded-md border transition-all active:scale-[0.98] flex items-center gap-2 ${showWhatsappPanel ? 'bg-primary-container text-white border-primary-container shadow-lg shadow-primary-container/20' : 'bg-crm-surface-container-low text-primary-container border-outline-variant/20 hover:bg-crm-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-sm">link</span>
                  {language === 'es' ? 'Conexión WhatsApp' : 'WhatsApp Connection'}
                </button>
              </div>
            </div>

            {/* WhatsApp Connection Panel */}
            {showWhatsappPanel && (
              <div className="bg-white/70 backdrop-blur-xl border border-slate-200/50 rounded-xl p-6 mb-2 animate-in slide-in-from-top duration-300">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500 rounded-lg">
                      <span className="material-symbols-outlined text-white text-lg">chat</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-primary">{language === 'es' ? 'Conexión WhatsApp Business' : 'WhatsApp Business Connection'}</h3>
                      <p className="text-[10px] text-slate-400">{language === 'es' ? 'Configura tus credenciales de la API de Meta' : 'Configure your Meta API credentials'}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowWhatsappPanel(false)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">WhatsApp Business API Key</label>
                    <div className="relative">
                      <input 
                        type={showWhatsappKey ? "text" : "password"} 
                        value={configData.whatsapp_token || ''}
                        onChange={e => setConfigData({...configData, whatsapp_token: e.target.value})}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-4 pr-12 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all font-mono"
                        placeholder="EAAxxxxxxx..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowWhatsappKey(!showWhatsappKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">{showWhatsappKey ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{language === 'es' ? 'Número de Teléfono (ID)' : 'Phone Number (ID)'}</label>
                    <input 
                      type="text" 
                      value={configData.whatsapp_phone_id || ''}
                      onChange={e => setConfigData({...configData, whatsapp_phone_id: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all font-mono"
                      placeholder="1234567890..."
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${configData.whatsapp_token && configData.whatsapp_phone_id ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`}></span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {configData.whatsapp_token && configData.whatsapp_phone_id 
                        ? (language === 'es' ? 'Credenciales configuradas' : 'Credentials configured') 
                        : (language === 'es' ? 'Sin configurar' : 'Not configured')}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => handleSaveSettings(e as any)}
                    className="px-5 py-2 bg-emerald-500 text-white font-bold text-xs rounded-lg hover:bg-emerald-600 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">save</span>
                    {language === 'es' ? 'Guardar Conexión' : 'Save Connection'}
                  </button>
                </div>
              </div>
            )}




            {/* Bento Layout Content */}
            <div className="grid grid-cols-12 gap-6">
              {/* Main Table Section */}
              <div className="col-span-12 lg:col-span-8 space-y-6">
                <div className="bg-crm-surface-container-lowest rounded-xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-primary font-headline">Conversation Registry</h3>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-crm-surface-container text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-tighter">Live Updates</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                          <th className="pb-4 px-4">{language === 'es' ? 'Contacto' : 'Contact'}</th>
                          <th className="pb-4 px-4">{language === 'es' ? 'Estado' : 'Status'}</th>
                          <th className="pb-4 px-4">{language === 'es' ? 'Ãšltima Actividad' : 'Last Activity'}</th>
                          <th className="pb-4 px-4 text-right">{language === 'es' ? 'Acciones' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Dynamic Data from conversationsData */}
                        {((conversationsData?.chatting || []).concat(conversationsData?.interested || []).concat(conversationsData?.bought || [])).slice(0, 5).map((conv: any, i: number) => {
                          const isChatting = conv.status === 'chatting';
                          const isInterested = conv.status === 'interested';
                          return (
                            <tr key={conv.id || i} className="group hover:bg-crm-surface transition-all duration-300">
                              <td className="bg-crm-surface-container-low py-4 px-4 rounded-l-lg">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${isChatting ? 'bg-primary-container/10 text-primary-container' : isInterested ? 'bg-secondary-container/20 text-secondary' : 'bg-slate-200 text-slate-500'}`}>
                                    {conv.customer_name?.substring(0, 2).toUpperCase() || 'CX'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-primary">{conv.customer_name || 'Desconocido'}</p>
                                    <p className="text-[11px] text-slate-400">{conv.phone_number}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="bg-crm-surface-container-low py-4 px-4">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold text-white ${isChatting ? 'bg-primary-container' : isInterested ? 'bg-secondary' : 'bg-outline'}`}>
                                  {isChatting && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
                                  {isChatting ? (language === 'es' ? 'Interesado' : 'Interested') : isInterested ? (language === 'es' ? 'Indeciso' : 'Undecided') : (language === 'es' ? 'Curioso' : 'Curious')}
                                </span>
                              </td>
                              <td className="bg-crm-surface-container-low py-4 px-4">
                                <p className="text-xs text-slate-600 font-medium">{formatRelativeTime(conv.created_at, language)}</p>
                              </td>
                              <td className="bg-crm-surface-container-low py-4 px-4 rounded-r-lg text-right">
                                <button className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors">more_vert</button>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Fallback Mock Data if empty */}
                        {(!conversationsData || Object.keys(conversationsData).length === 0) && (
                          <tr className="group hover:bg-crm-surface transition-all duration-300">
                            <td className="bg-crm-surface-container-low py-4 px-4 rounded-l-lg" colSpan={4}>
                              <div className="flex justify-center p-4">
                                <p className="text-sm text-slate-500">No hay datos de conversaciones recientes.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* AI Section Side Panel */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                {/* Stats Card */}
                <div className="bg-primary p-6 rounded-xl text-white overflow-hidden relative">
                  <div className="relative z-10">
                    <p className="text-xs font-bold text-on-primary-container uppercase tracking-widest mb-4">Sentiment Mix</p>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1 font-medium">
                          <span>Conversion Ready</span>
                          <span>{conversationsData?.interested?.length || 0} Leads</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-white w-[64%]"></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1 font-medium">
                          <span>Nurturing Required</span>
                          <span>{conversationsData?.chatting?.length || 0} Activos</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-white/50 w-[22%]"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
                </div>

                {/* Chat de Pruebas */}
                <div className="bg-white/70 backdrop-blur-xl border border-slate-200/50 rounded-xl p-6 flex flex-col h-[480px]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary-container rounded-lg">
                        <span className="material-symbols-outlined text-white text-lg">psychology</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-primary">Chat de Pruebas AI</h3>
                        <p className="text-[10px] text-slate-400">Neural Classification Test</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleResetTestChat}
                      className="p-2 text-slate-400 hover:text-primary-container hover:bg-primary-container/10 rounded-lg transition-all"
                      title="Reset Chat"
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                    </button>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto mb-4 pr-2">
                    {testMessages.map((m, idx) => (
                      <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} gap-1`}>
                        <div className={`${m.role === 'user' ? 'bg-primary-container text-white rounded-br-sm' : 'bg-crm-surface-container-high text-on-surface rounded-bl-sm'} px-4 py-2 rounded-xl text-xs leading-relaxed max-w-[85%]`}>
                          {m.content}
                        </div>
                        <span className={`text-[9px] text-slate-400 ${m.role === 'user' ? 'mr-1' : 'ml-1'}`}>
                          {m.role === 'user' ? 'Tú (Simulado)' : 'AI Assistant'}
                        </span>
                      </div>
                    ))}


                  </div>

                  <form onSubmit={handleTestChatSubmit} className="relative mt-auto">
                    <input 
                      className="w-full pl-4 pr-12 py-3 bg-white border border-outline-variant/30 rounded-lg text-xs focus:ring-2 focus:ring-primary-container/20 focus:border-primary-container outline-none transition-all text-black" 
                      placeholder="Escribe un mensaje de prueba..." 
                      type="text"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      disabled={isTestingAi}
                    />
                    <button 
                      type="submit"
                      disabled={isTestingAi || !testInput.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-primary text-white rounded-md hover:bg-primary-container transition-colors disabled:opacity-50"
                    >
                      {isTestingAi ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-sm">send</span>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'crm' && (
          <>
            {/* Editorial Header Section */}
            <section className="mb-12 flex justify-between items-end">
              <div className="max-w-2xl">
                <span className="text-primary-container font-extrabold tracking-[0.2em] text-[10px] uppercase mb-2 block">Enterprise CRM</span>
                <h1 className="text-5xl font-extrabold text-primary tracking-tight mb-4 font-headline">{language === 'en' ? 'Audience Intelligence' : 'Inteligencia de Audiencia'}</h1>
                <p className="text-lg text-slate-500 font-light leading-relaxed">
                  {language === 'en' ? 'Advanced orchestration of your WhatsApp ecosystem. Synchronize, segment, and influence your contact base with real-time AI behavioral detection.' : 'Orquestación avanzada de tu ecosistema WhatsApp. Sincroniza, segmenta e influye en tu base de contactos con detección de comportamiento de IA en tiempo real.'}
                </p>
              </div>
              <div className="flex gap-3">
                {/* === EXPORTAR CSV (Facebook Remarketing) === */}
                <button 
                  onClick={() => {
                    if (allContacts.length === 0) return;
                    // Facebook Custom Audience CSV format
                    const headers = ['phone','fn','country'];
                    const rows = allContacts.map((c: any) => {
                      const cleanPhone = (c.phone_number || '').replace(/[^0-9+]/g, '');
                      const firstName = (c.customer_name || 'N/A').split(' ')[0] || 'Cliente';
                      return `${cleanPhone},${firstName},MX`;
                    });
                    const csv = [headers.join(','), ...rows].join('\n');
                    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `rifx_contacts_facebook_${new Date().toISOString().slice(0,10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-6 py-3 rounded-md bg-crm-surface-container-high text-primary font-bold text-sm hover:bg-crm-surface-container-highest transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">file_download</span>
                  {language === 'en' ? 'Export CSV' : 'Exportar CSV'}
                </button>
                {/* === AGREGAR CONTACTO === */}
                <button 
                  onClick={() => { setShowAddContact(true); setAddContactSuccess(false); setNewContact({ name: '', phone: '', message: '', countryCode: '+593', testMode: false, testPhone: '' }); }}
                  className="px-6 py-3 rounded-md bg-primary-container text-white font-bold text-sm shadow-xl hover:shadow-primary-container/20 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">person_add</span>
                  {language === 'en' ? 'Add Contact' : 'Agregar Contacto'}
                </button>
                <button 
                  onClick={() => setShowBulkPanel(!showBulkPanel)}
                  className={`px-6 py-3 font-bold text-sm rounded-md shadow-lg transition-all active:scale-[0.98] flex items-center gap-2 ${showBulkPanel ? 'bg-white text-primary-container border border-primary-container' : 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-amber-500/20 hover:opacity-90'}`}
                >
                  <span className="material-symbols-outlined text-lg">campaign</span>
                  {language === 'en' ? 'Bulk Messages' : 'Mensajes Masivos'}
                </button>
              </div>
            </section>

            {/* === MODAL AGREGAR CONTACTO === */}
            {showAddContact && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setShowAddContact(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-primary to-primary-container p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                          <span className="material-symbols-outlined">person_add</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{language === 'es' ? 'Agregar Contacto' : 'Add Contact'}</h3>
                          <p className="text-white/70 text-xs">{language === 'es' ? 'Crea un nuevo contacto y la IA le envía el primer mensaje' : 'Create a new contact and AI sends the first message'}</p>
                        </div>
                      </div>
                      <button onClick={() => setShowAddContact(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  </div>
                  {/* Body */}
                  <div className="p-6 space-y-4">
                    {addContactSuccess ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-emerald-600 text-3xl">check_circle</span>
                        </div>
                        <h4 className="text-lg font-bold text-primary mb-2">{language === 'es' ? '\u00A1Contacto Agregado!' : 'Contact Added!'}</h4>
                        <p className="text-slate-500 text-sm">{language === 'es' ? 'El mensaje ha sido enviado por la IA exitosamente.' : 'The AI message was sent successfully.'}</p>
                        <button onClick={() => { setShowAddContact(false); fetchConversations(); }} className="mt-6 px-6 py-2 bg-primary-container text-white rounded-lg font-bold text-sm">
                          {language === 'es' ? 'Cerrar' : 'Close'}
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Test Mode Toggle */}
                        <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-600 text-lg">science</span>
                            <div>
                              <p className="text-xs font-bold text-amber-800">{language === 'es' ? 'Modo Prueba' : 'Test Mode'}</p>
                              <p className="text-[9px] text-amber-600">{language === 'es' ? 'Env\u00EDa a tu n\u00FAmero para ver c\u00F3mo llega' : 'Send to your number to preview'}</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={newContact.testMode || false}
                              onChange={e => setNewContact((p: any) => ({ ...p, testMode: e.target.checked }))}
                            />
                            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                          </label>
                        </div>

                        {/* Test Number Input (only when test mode is on) */}
                        {newContact.testMode && (
                          <div className="p-3 bg-amber-50/50 border border-dashed border-amber-200 rounded-xl">
                            <label className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1 block">{language === 'es' ? 'N\u00FAmero de prueba' : 'Test number'}</label>
                            <div className="flex gap-2">
                              <div className="relative" style={{width: '130px'}}>
                                <select
                                  value={newContact.countryCode || '+593'}
                                  onChange={e => setNewContact((p: any) => ({ ...p, countryCode: e.target.value }))}
                                  className="w-full h-full px-2 py-2.5 bg-white border border-amber-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 appearance-none cursor-pointer"
                                >
                                  {[
                                    { code: '+593', name: 'Ecuador' },
                                    { code: '+52', name: 'M\u00E9xico' },
                                    { code: '+1', name: 'USA' },
                                    { code: '+57', name: 'Colombia' },
                                    { code: '+51', name: 'Per\u00FA' },
                                    { code: '+54', name: 'Argentina' },
                                    { code: '+56', name: 'Chile' },
                                    { code: '+58', name: 'Venezuela' },
                                    { code: '+591', name: 'Bolivia' },
                                    { code: '+595', name: 'Paraguay' },
                                    { code: '+598', name: 'Uruguay' },
                                    { code: '+507', name: 'Panam\u00E1' },
                                    { code: '+506', name: 'Costa Rica' },
                                    { code: '+502', name: 'Guatemala' },
                                    { code: '+503', name: 'El Salvador' },
                                    { code: '+504', name: 'Honduras' },
                                    { code: '+505', name: 'Nicaragua' },
                                    { code: '+34', name: 'Espa\u00F1a' },
                                    { code: '+55', name: 'Brasil' },
                                    { code: '+44', name: 'UK' },
                                    { code: '+49', name: 'Alemania' },
                                    { code: '+33', name: 'Francia' },
                                    { code: '+39', name: 'Italia' },
                                  ].map(c => (
                                    <option key={c.code} value={c.code}>{c.code} {c.name}</option>
                                  ))}
                                </select>
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none material-symbols-outlined text-amber-400 text-sm">expand_more</span>
                              </div>
                              <input
                                type="text"
                                value={newContact.testPhone || ''}
                                onChange={e => setNewContact((p: any) => ({ ...p, testPhone: e.target.value.replace(/[^0-9]/g, '') }))}
                                placeholder="987654321"
                                className="flex-1 px-3 py-2.5 bg-white border border-amber-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-300"
                              />
                            </div>
                            <p className="text-[9px] text-amber-500 mt-1 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[9px]">info</span>
                              {language === 'es' ? 'El mensaje se enviar\u00E1 a este n\u00FAmero sin crear contacto' : 'Message will be sent to this number without creating a contact'}
                            </p>
                          </div>
                        )}

                        {!newContact.testMode && (
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">{language === 'es' ? 'Nombre completo' : 'Full name'}</label>
                            <input
                              type="text"
                              value={newContact.name}
                              onChange={e => setNewContact((p: any) => ({ ...p, name: e.target.value }))}
                              placeholder="Ej: Juan Pérez"
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container"
                            />
                          </div>
                        )}
                        {!newContact.testMode && (
                          <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">{language === 'es' ? 'Tel\u00E9fono' : 'Phone'}</label>
                            <div className="flex gap-2">
                              <div className="relative" style={{width: '130px'}}>
                                <select
                                  value={newContact.countryCode || '+593'}
                                  onChange={e => setNewContact((p: any) => ({ ...p, countryCode: e.target.value }))}
                                  className="w-full h-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container appearance-none cursor-pointer"
                                >
                                  {[
                                    { code: '+593', name: 'Ecuador' },
                                    { code: '+52', name: 'M\u00E9xico' },
                                    { code: '+1', name: 'USA' },
                                    { code: '+57', name: 'Colombia' },
                                    { code: '+51', name: 'Per\u00FA' },
                                    { code: '+54', name: 'Argentina' },
                                    { code: '+56', name: 'Chile' },
                                    { code: '+58', name: 'Venezuela' },
                                    { code: '+591', name: 'Bolivia' },
                                    { code: '+595', name: 'Paraguay' },
                                    { code: '+598', name: 'Uruguay' },
                                    { code: '+507', name: 'Panam\u00E1' },
                                    { code: '+506', name: 'Costa Rica' },
                                    { code: '+502', name: 'Guatemala' },
                                    { code: '+503', name: 'El Salvador' },
                                    { code: '+504', name: 'Honduras' },
                                    { code: '+505', name: 'Nicaragua' },
                                    { code: '+34', name: 'Espa\u00F1a' },
                                    { code: '+55', name: 'Brasil' },
                                    { code: '+44', name: 'UK' },
                                    { code: '+49', name: 'Alemania' },
                                    { code: '+33', name: 'Francia' },
                                    { code: '+39', name: 'Italia' },
                                  ].map(c => (
                                    <option key={c.code} value={c.code}>{c.code} {c.name}</option>
                                  ))}
                                </select>
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none material-symbols-outlined text-slate-400 text-sm">expand_more</span>
                              </div>
                              <input
                                type="text"
                                value={newContact.phone}
                                onChange={e => setNewContact((p: any) => ({ ...p, phone: e.target.value.replace(/[^0-9]/g, '') }))}
                                placeholder="9 8765 4321"
                                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container"
                              />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">{language === 'es' ? 'El c\u00F3digo de pa\u00EDs se agrega autom\u00E1ticamente' : 'Country code is added automatically'}</p>
                          </div>
                        )}
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs text-violet-500">auto_awesome</span>
                              {language === 'es' ? 'Describe qu\u00E9 quieres comunicar (la IA lo perfecciona)' : 'Describe what you want to communicate (AI refines it)'}
                            </span>
                          </label>
                          <textarea
                            value={newContact.message}
                            onChange={e => setNewContact((p: any) => ({ ...p, message: e.target.value }))}
                            rows={3}
                            placeholder={language === 'es' ? 'Ej: Quiero ofrecerle nuestro servicio de automatizaci\u00F3n con IA para su negocio...' : 'E.g.: I want to offer them our AI automation service for their business...'}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-container/30 focus:border-primary-container resize-none"
                          />
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px]">info</span>
                            {language === 'es' ? 'La IA redactar\u00E1 un mensaje profesional basado en tu descripci\u00F3n y el prompt configurado' : 'AI will craft a professional message based on your description and configured prompt'}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            const isTest = newContact.testMode;
                            if (isTest) {
                              if (!newContact.testPhone?.trim() || !newContact.message.trim()) return;
                            } else {
                              if (!newContact.name.trim() || !newContact.phone.trim()) return;
                            }
                            setIsAddingContact(true);
                            const fullPhone = isTest
                              ? (newContact.countryCode || '+593').replace('+', '') + (newContact.testPhone || '').replace(/^0+/, '')
                              : (newContact.countryCode || '+593').replace('+', '') + newContact.phone.replace(/^0+/, '');
                            try {
                              const res = await fetch('/api/panel/add-contact', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  name: isTest ? 'Prueba de Mensaje' : newContact.name, 
                                  phone: fullPhone, 
                                  message: newContact.message,
                                  testMode: isTest
                                })
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setAddContactSuccess(true);
                                if (!isTest) fetchConversations();
                              } else {
                                alert(data.error || 'Error al enviar');
                              }
                            } catch (err) { console.error(err); }
                            finally { setIsAddingContact(false); }
                          }}
                          disabled={isAddingContact || (newContact.testMode ? (!newContact.testPhone?.trim() || !newContact.message.trim()) : (!newContact.name.trim() || !newContact.phone.trim()))}
                          className={`w-full py-3 ${newContact.testMode ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-primary to-primary-container'} text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40`}
                        >
                          {isAddingContact ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              {newContact.testMode ? (language === 'es' ? 'Enviando prueba...' : 'Sending test...') : (language === 'es' ? 'Creando y enviando...' : 'Creating & sending...')}
                            </>
                          ) : newContact.testMode ? (
                            <>
                              <span className="material-symbols-outlined text-sm">science</span>
                              {language === 'es' ? 'Enviar Mensaje de Prueba' : 'Send Test Message'}
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-sm">send</span>
                              {newContact.message.trim() 
                                ? (language === 'es' ? 'Agregar y Enviar Mensaje con IA' : 'Add & Send AI Message') 
                                : (language === 'es' ? 'Agregar Contacto' : 'Add Contact')}
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Stats Grid (Bento Style) */}
            <section className="grid grid-cols-12 gap-6 mb-12">
              <div className="col-span-12 lg:col-span-8 grid grid-cols-3 gap-6">
                {/* USUARIOS TOTALES - Live */}
                <div className="bg-crm-surface-container-lowest p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-white/50 relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary-container/5 rounded-full blur-2xl group-hover:bg-primary-container/10 transition-colors"></div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{language === 'en' ? 'Total Users' : 'Usuarios Totales'}</p>
                  <h3 className="text-3xl font-extrabold text-primary">{allContacts.length}</h3>
                  <div className="flex items-center gap-1 mt-2 text-emerald-500 font-bold text-xs">
                    <span className="material-symbols-outlined text-xs">groups</span>
                    <span>{language === 'es' ? 'Contactos en base de datos' : 'Contacts in database'}</span>
                  </div>
                </div>
                {/* ACTIVOS AHORA - only contacts with activity in last hour */}
                <div className="bg-crm-surface-container-lowest p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-white/50">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{language === 'en' ? 'Active Now' : 'Activos Ahora'}</p>
                  <h3 className={`text-3xl font-extrabold ${activeNowContacts.length > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>{activeNowContacts.length}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    {activeNowContacts.length > 0 ? (
                      <>
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-emerald-600 text-xs font-medium truncate">
                          {activeNowContacts.slice(0, 3).map((c: any) => (c.customer_name || 'Sin nombre').split(' ')[0]).join(', ')}
                          {activeNowContacts.length > 3 ? ` +${activeNowContacts.length - 3}` : ''}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="flex h-2 w-2 rounded-full bg-slate-300"></span>
                        <span className="text-slate-400 text-xs font-medium">{language === 'es' ? 'Sin conversaciones activas' : 'No active conversations'}</span>
                      </>
                    )}
                  </div>
                </div>
                {/* CONFIANZA DE IA - Live AI evaluation */}
                <div 
                  className="bg-crm-surface-container-lowest p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-white/50 cursor-pointer hover:border-primary-container/30 transition-all group"
                  onClick={async () => {
                    if (isEvaluatingAi) return;
                    setIsEvaluatingAi(true);
                    try {
                      const res = await fetch('/api/panel/ai-confidence', { method: 'POST' });
                      const data = await res.json();
                      setAiConfidence(data.score);
                      setAiConfidenceReason(data.reason || '');
                    } catch (err) { console.error(err); }
                    finally { setIsEvaluatingAi(false); }
                  }}
                >
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{language === 'en' ? 'AI Confidence' : 'Confianza de IA'}</p>
                  {isEvaluatingAi ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span className="text-xs text-slate-400">{language === 'es' ? 'Evaluando prompt...' : 'Evaluating prompt...'}</span>
                    </div>
                  ) : (
                    <h3 className={`text-3xl font-extrabold ${aiConfidence !== null ? (aiConfidence >= 75 ? 'text-emerald-600' : aiConfidence >= 50 ? 'text-amber-500' : 'text-red-500') : 'text-primary'}`}>
                      {aiConfidence !== null ? `${aiConfidence}%` : '\u2014'}
                    </h3>
                  )}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${aiConfidence !== null ? (aiConfidence >= 75 ? 'bg-emerald-500' : aiConfidence >= 50 ? 'bg-amber-500' : 'bg-red-400') : 'bg-slate-200'}`} style={{ width: `${aiConfidence ?? 0}%` }}></div>
                  </div>
                  {aiConfidenceReason && (
                    <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">{aiConfidenceReason}</p>
                  )}
                  {aiConfidence === null && !isEvaluatingAi && (
                    <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="material-symbols-outlined text-[10px]">touch_app</span>
                      {language === 'es' ? 'Click para evaluar tu prompt' : 'Click to evaluate your prompt'}
                    </p>
                  )}
                </div>
              </div>
              <div className="col-span-12 lg:col-span-4 bg-gradient-to-br from-primary to-primary-container p-6 rounded-xl shadow-xl text-white flex flex-col justify-between">
                <div>
                  <h4 className="text-lg font-bold mb-1">{language === 'en' ? 'Predictive Insights' : 'Insights Predictivos'}</h4>
                  <p className="text-sm text-white/70 font-light">{language === 'en' ? 'AI detects contacts most likely to resume conversations in the next 24-48 hours.' : 'La IA detecta contactos con mayor probabilidad de retomar conversaciones en las próximas 24-48 horas.'}</p>
                </div>
                <button 
                  onClick={async () => {
                    if (showPredictions) { setShowPredictions(false); return; }
                    setIsLoadingPredictions(true);
                    setShowPredictions(true);
                    try {
                      const res = await fetch('/api/panel/predictions', { method: 'POST' });
                      const data = await res.json();
                      setPredictions(data.predictions || []);
                    } catch (err) { console.error(err); }
                    finally { setIsLoadingPredictions(false); }
                  }}
                  className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded font-bold text-xs transition-colors border border-white/20 flex items-center justify-center gap-2"
                >
                  {isLoadingPredictions ? (
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-sm">{showPredictions ? 'expand_less' : 'psychology'}</span>
                  )}
                  {isLoadingPredictions 
                    ? (language === 'es' ? 'Analizando...' : 'Analyzing...') 
                    : showPredictions 
                      ? (language === 'es' ? 'Ocultar' : 'Hide') 
                      : (language === 'es' ? 'Ver Predicciones' : 'View Predictions')}
                </button>
              </div>
            </section>

            {/* === PREDICTIONS PANEL === */}
            {showPredictions && predictions.length > 0 && (
              <div className="bg-white/70 backdrop-blur-xl border border-slate-200/50 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-violet-500 to-primary-container rounded-lg">
                      <span className="material-symbols-outlined text-white text-lg">psychology</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-primary">{language === 'es' ? 'Contactos con Mayor Probabilidad de Retomar Conversación' : 'Contacts Most Likely to Re-engage'}</h3>
                      <p className="text-[10px] text-slate-400">{language === 'es' ? `${predictions.length} contactos analizados por la IA` : `${predictions.length} contacts analyzed by AI`}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowPredictions(false)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {predictions.map((p, i) => (
                    <div key={p.id || i} className="bg-crm-surface-container-lowest rounded-xl border border-slate-100 p-4 hover:shadow-md hover:border-primary-container/30 transition-all group">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${p.score >= 80 ? 'bg-emerald-500' : p.score >= 60 ? 'bg-amber-500' : 'bg-slate-400'}`}>
                            {i + 1}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-primary truncate max-w-[120px]">{p.name}</p>
                            <p className="text-[9px] text-slate-400">{p.phone}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-extrabold ${p.score >= 80 ? 'text-emerald-500' : p.score >= 60 ? 'text-amber-500' : 'text-slate-400'}`}>{p.score}%</p>
                        </div>
                      </div>
                      
                      {/* Score bar */}
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-700 ${p.score >= 80 ? 'bg-emerald-500' : p.score >= 60 ? 'bg-amber-500' : 'bg-slate-400'}`}
                          style={{ width: `${p.score}%` }}
                        />
                      </div>

                      <p className="text-[10px] text-slate-500 leading-relaxed mb-3">{p.reason}</p>

                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${p.status === 'interested' ? 'bg-amber-100 text-amber-700' : p.status === 'chatting' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {p.status === 'interested' ? (language === 'es' ? 'Interesado' : 'Interested') : p.status === 'chatting' ? (language === 'es' ? 'Activo' : 'Active') : (language === 'es' ? 'Compró' : 'Bought')}
                        </span>
                        <button 
                          onClick={() => {
                            setBulkMessage(`¡Hola ${p.name.split(' ')[0]}! `);
                            setSelectedContacts(new Set([p.id]));
                            setShowBulkPanel(true);
                            setShowPredictions(false);
                          }}
                          className="text-[9px] font-bold text-primary-container hover:underline flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <span className="material-symbols-outlined text-xs">send</span>
                          {language === 'es' ? 'Contactar' : 'Contact'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Data Table and Detail Panel Layout */}
            <div className="flex gap-8 items-start">
              {/* Table Container */}
              <div className="flex-1">
                <div className="bg-crm-surface-container-lowest rounded-2xl shadow-sm border border-white/50 overflow-hidden">
                  {/* Table Search & Filter Header */}
                  <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-4">
                      <h3 className="font-extrabold text-primary flex items-center gap-2">
                        {language === 'en' ? 'Contact Directory' : 'Directorio de Contactos'}
                        <span className="bg-crm-surface-container-low px-2 py-0.5 rounded-full text-[10px] text-slate-400 font-bold">{tableContacts.length} {language === 'es' ? 'mostrados' : 'shown'}</span>
                      </h3>
                      <div className="h-4 w-[1px] bg-slate-200"></div>
                      <div className="flex gap-2">
                        {(['all', 'chatting', 'interested'] as const).map(tab => (
                          <span
                            key={tab}
                            onClick={() => { setTableFilter(tab); setTablePage(1); }}
                            className={`px-3 py-1 text-[11px] font-bold rounded-full cursor-pointer transition-colors ${tableFilter === tab ? 'bg-primary/5 text-primary border border-primary/10' : 'text-slate-400 hover:bg-slate-50'}`}
                          >
                            {tab === 'all' ? (language === 'es' ? 'Todos' : 'All') : tab === 'interested' ? (language === 'es' ? 'Interesados' : 'Interested') : (language === 'es' ? 'Chateando' : 'Chatting')}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Sort dropdown */}
                      <select
                        value={tableSortBy}
                        onChange={e => { setTableSortBy(e.target.value as any); setTablePage(1); }}
                        className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 font-medium focus:outline-none focus:ring-1 focus:ring-primary-container/30 cursor-pointer"
                      >
                        <option value="recent">{language === 'es' ? ' Más recientes' : ' Most recent'}</option>
                        <option value="alpha">{language === 'es' ? ' Alfabético' : ' Alphabetical'}</option>
                        <option value="active">{language === 'es' ? ' Activos primero' : ' Active first'}</option>
                      </select>
                      <button 
                        onClick={() => fetchContactScores(pagedContacts)}
                        className="p-2 text-slate-400 hover:text-primary transition-colors relative" title={language === 'es' ? 'Recalcular puntajes IA' : 'Recalculate AI scores'}
                      >
                        <span className={`material-symbols-outlined text-sm ${isLoadingScores ? 'animate-spin' : ''}`}>{isLoadingScores ? 'progress_activity' : 'auto_awesome'}</span>
                      </button>
                    </div>
                  </div>
                  {/* Modern Data Table */}
                  <table className="w-full text-left border-collapse bg-white">
                    <thead>
                      <tr className="bg-crm-surface-container-low/30 border-b border-slate-50">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'User Identity' : 'Identidad del Usuario'}</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'Status & Intent' : 'Estado e Intención'}</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'Last Engagement' : 'Ãšltima Interacción'}</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'AI Score' : 'Puntaje IA'}</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">{language === 'en' ? 'Actions' : 'Acciones'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pagedContacts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                            {language === 'es' ? 'No hay contactos en esta categoría' : 'No contacts in this category'}
                          </td>
                        </tr>
                      ) : pagedContacts.map((conv: any, idx: number) => {
                        const scoreData = contactScores[conv.id];
                        const aiScore = scoreData?.score ?? null;
                        const scoreReason = scoreData?.reason || '';
                        const oneH = Date.now() - 3600000;
                        const isActive = conv.updated_at && new Date(conv.updated_at).getTime() > oneH;
                        const lastDate = conv.updated_at || conv.created_at;
                        return (
                          <tr key={conv.id} onClick={() => setSelectedChat({id: conv.id, name: conv.customer_name, status: conv.status, phone_number: conv.phone_number, created_at: conv.created_at})} className={`hover:bg-surface-bright transition-colors group cursor-pointer ${idx % 2 !== 0 ? 'bg-crm-surface-container-low/10' : ''}`}>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                    {conv.customer_name?.substring(0, 2).toUpperCase() || 'U'}
                                  </div>
                                  <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                </div>
                                <div>
                                  <p className="font-bold text-primary group-hover:text-primary-container transition-colors">{conv.customer_name || 'Usuario'}</p>
                                  <p className="text-xs text-slate-400">{conv.phone_number}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${conv.status === 'chatting' ? 'bg-[#eef2ff] text-[#000080]' : conv.status === 'interested' ? 'bg-[#fffbeb] text-[#b45309]' : 'bg-[#ecfdf5] text-[#047857]'}`}>
                                {conv.status === 'chatting' ? (language === 'en' ? 'Chatting' : 'Chateando') : conv.status === 'interested' ? (language === 'en' ? 'Interested' : 'Interesado') : (language === 'en' ? 'Bought' : 'Compró')}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <p className="text-xs text-on-surface font-medium mb-1 truncate max-w-[180px]">
                                {isActive 
                                  ? (language === 'es' ? ' Conversando ahora' : ' Chatting now')
                                  : (language === 'es' ? 'Ãšltima actividad' : 'Last activity')}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {lastDate ? new Date(lastDate).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '\u2014'}
                              </p>
                            </td>
                            <td className="px-6 py-5">
                              {aiScore !== null ? (
                                <div className="flex items-center gap-2" title={scoreReason}>
                                  <div className={`text-xs font-extrabold ${aiScore >= 75 ? 'text-emerald-600' : aiScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{aiScore}%</div>
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${aiScore >= 75 ? 'bg-emerald-500' : aiScore >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{width: `${aiScore}%`}}></div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 border-2 border-slate-200 border-t-primary/50 rounded-full animate-spin"></div>
                                  <span className="text-[10px] text-slate-400">...</span>
                                </div>
                              )}
                              {scoreReason && <p className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[120px]">{scoreReason}</p>}
                            </td>
                            <td className="px-6 py-5 text-right">
                              <button className="p-2 text-slate-300 hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); setSelectedChat({id: conv.id, name: conv.customer_name, status: conv.status, phone_number: conv.phone_number, created_at: conv.created_at}); setShowChartModal(true); }}>
                                <span className="material-symbols-outlined">chat_bubble</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {/* Pagination */}
                  <div className="px-6 py-4 bg-white border-t border-slate-50 flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      {language === 'es' ? `Página ${tablePage} de ${totalTablePages} · ${tableContacts.length} contactos` : `Page ${tablePage} of ${totalTablePages} · ${tableContacts.length} contacts`}
                    </p>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setTablePage(p => Math.max(1, p - 1))} 
                        disabled={tablePage <= 1}
                        className="p-2 border border-slate-100 rounded hover:bg-slate-50 transition-colors disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                      </button>
                      {Array.from({ length: Math.min(totalTablePages, 5) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <button key={page} onClick={() => setTablePage(page)} className={`px-3 py-1.5 border rounded text-xs font-bold transition-colors ${tablePage === page ? 'bg-primary-container text-white border-primary-container' : 'border-slate-100 text-slate-500 hover:bg-slate-50'}`}>
                            {page}
                          </button>
                        );
                      })}
                      <button 
                        onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))} 
                        disabled={tablePage >= totalTablePages}
                        className="p-2 border border-slate-100 rounded hover:bg-slate-50 transition-colors disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail Sidebar (Selected User) */}
              <aside className="w-96 sticky top-24">
                <div className="bg-crm-surface-container-low rounded-2xl shadow-sm flex flex-col relative overflow-hidden">
                  {selectedChat ? (
                    <>
                      {/* Header Banner with Gradient */}
                      <div className="relative h-20 bg-gradient-to-br from-primary-container via-primary to-primary-container/80 overflow-hidden">
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute top-2 right-4 w-20 h-20 border border-white/30 rounded-full" />
                          <div className="absolute bottom-0 left-8 w-32 h-32 border border-white/20 rounded-full -mb-16" />
                        </div>
                        {/* Status Badge */}
                        <div className="absolute top-3 right-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest backdrop-blur-sm ${
                            selectedChat.status === 'interested' ? 'bg-emerald-500/90 text-white' 
                            : selectedChat.status === 'chatting' ? 'bg-amber-500/90 text-white' 
                            : 'bg-white/20 text-white'
                          }`}>
                            {selectedChat.status === 'interested' ? (language === 'en' ? 'Interested' : 'Interesado') 
                            : selectedChat.status === 'chatting' ? (language === 'en' ? 'Chatting' : 'En Chat') 
                            : selectedChat.status || 'Activo'}
                          </span>
                        </div>
                      </div>

                      {/* Avatar + Name below banner */}
                      <div className="px-6 -mt-8 relative z-10 flex flex-col items-center text-center">
                        <div className="relative mb-3">
                          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-primary font-black text-xl shadow-xl border-4 border-white">
                            {selectedChat.name?.substring(0, 2).toUpperCase() || 'U'}
                          </div>
                          <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-lg shadow-md">
                            <span className="material-symbols-outlined text-xs" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                          </div>
                        </div>
                        <h3 className="text-base font-extrabold text-primary truncate max-w-full">{selectedChat.name || 'Usuario'}</h3>
                        <p className="text-xs text-slate-400 font-mono font-bold">{selectedChat.phone_number}</p>
                      </div>

                      {/* Quick Stats Row */}
                      <div className="px-6 pt-5">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                            <p className="text-lg font-black text-primary">{(() => { const allConvs = (conversationsData?.chatting || []).concat(conversationsData?.interested || []).concat(conversationsData?.bought || []); const conv = allConvs.find((c: any) => c.id === selectedChat.id); return conv?.messages?.length || 0; })()}</p>
                            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'Messages' : 'Mensajes'}</p>
                          </div>
                          <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                            <p className="text-lg font-black text-emerald-500">{selectedChat.status === 'interested' ? '87%' : selectedChat.status === 'chatting' ? '54%' : '32%'}</p>
                            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'Score' : 'Puntaje'}</p>
                          </div>
                          <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                            <p className="text-lg font-black text-amber-500">{(() => { const d = selectedChat.created_at ? Math.ceil((Date.now() - new Date(selectedChat.created_at).getTime()) / 86400000) : 0; return d > 0 ? d : 1; })()}d</p>
                            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'Age' : 'Antig\u00FCedad'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Contact Details Card */}
                      <div className="px-6 pt-4">
                        <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50">
                          <div className="flex items-center gap-3 px-4 py-3">
                            <span className="material-symbols-outlined text-slate-400 text-base">phone</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'Phone' : 'Tel\u00E9fono'}</p>
                              <p className="text-xs font-bold text-slate-700 truncate">{selectedChat.phone_number || 'N/A'}</p>
                            </div>
                            <button onClick={() => { navigator.clipboard.writeText(selectedChat.phone_number || ''); }} className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                              <span className="material-symbols-outlined text-slate-300 text-sm">content_copy</span>
                            </button>
                          </div>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <span className="material-symbols-outlined text-slate-400 text-base">calendar_today</span>
                            <div className="flex-1">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'First Contact' : 'Primer Contacto'}</p>
                              <p className="text-xs font-bold text-slate-700">{selectedChat.created_at ? new Date(selectedChat.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <span className="material-symbols-outlined text-slate-400 text-base">hub</span>
                            <div className="flex-1">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'Channel' : 'Canal'}</p>
                              <p className="text-xs font-bold text-slate-700">WhatsApp</p>
                            </div>
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          </div>
                        </div>
                      </div>



                      {/* Activity Timeline */}
                      <div className="px-6 pt-4">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">{language === 'en' ? 'Recent Activity' : 'Actividad Reciente'}</p>
                        <div className="space-y-0">
                          {[
                            { icon: 'mail', iconBg: 'bg-primary-container', color: 'text-white', title: language === 'en' ? 'Message Received' : 'Mensaje Recibido', desc: language === 'en' ? '"Active interaction detected..."' : '"Interacci\u00F3n activa detectada..."', time: language === 'en' ? 'Today' : 'Hoy' },
                            { icon: 'label', iconBg: 'bg-amber-400', color: 'text-white', title: language === 'en' ? 'Segment Updated' : 'Segmento Actualizado', desc: `Status → ${selectedChat.status}`, time: selectedChat.created_at ? new Date(selectedChat.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short' }) : '' },
                            { icon: 'smart_toy', iconBg: 'bg-slate-200', color: 'text-slate-500', title: language === 'en' ? 'AI Classified' : 'IA Clasificado', desc: language === 'en' ? 'Auto-categorized by neural engine' : 'Auto-categorizado por motor neuronal', time: selectedChat.created_at ? new Date(selectedChat.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short' }) : '' },
                          ].map((item, idx) => (
                            <div key={idx} className={`flex gap-3 relative ${idx < 2 ? 'pb-4' : ''}`}>
                              {idx < 2 && <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-slate-100" />}
                              <div className={`w-6 h-6 min-w-[24px] rounded-full ${item.iconBg} flex items-center justify-center ${item.color} z-10 shrink-0`}>
                                <span className="material-symbols-outlined text-[12px]">{item.icon}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-slate-700">{item.title}</p>
                                <p className="text-[10px] text-slate-400 truncate">{item.desc}</p>
                                <span className="text-[9px] text-slate-300">{item.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="px-6 py-5">
                        <button 
                          onClick={() => setShowChartModal(true)} 
                          className="w-full py-3 bg-primary-container text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary-container/20 hover:shadow-xl hover:shadow-primary-container/30 transition-all flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">chat</span>
                          {language === 'en' ? 'Direct Chat' : 'Chat Directo'}
                        </button>
                        {/* Quick Action Bar */}
                        <div className="flex items-center justify-center gap-1 mt-3">
                          <button onClick={() => { const phone = (selectedChat.phone_number || '').replace(/[^0-9]/g, ''); if (phone) window.open(`https://wa.me/${phone}`, '_blank'); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors group" title="WhatsApp">
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-[#25D366] text-base">chat</span>
                          </button>
                          <button onClick={() => { const phone = (selectedChat.phone_number || '').replace(/[^0-9]/g, ''); if (phone) window.open(`tel:+${phone}`); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors group" title={language === 'en' ? 'Call' : 'Llamar'}>
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-500 text-base">call</span>
                          </button>
                          <button onClick={() => { navigator.clipboard.writeText(selectedChat.phone_number || ''); }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors group" title={language === 'en' ? 'Copy' : 'Copiar'}>
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-600 text-base">content_copy</span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16 px-8 text-slate-400 text-sm font-bold flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-slate-300">person_search</span>
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-500">{language === 'en' ? 'No user selected' : 'Ning\u00FAn usuario seleccionado'}</p>
                        <p className="text-xs text-slate-400 mt-1">{language === 'en' ? 'Select a user to view detailed intelligence profile' : 'Selecciona un usuario para ver su perfil de inteligencia'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}

        {/* SETTINGS AREA */}
        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-10"
          >
            {/* Header Section */}
            <header className="mb-12">
              <h2 className="text-4xl font-extrabold font-headline text-primary tracking-tight">
                {language === 'en' ? 'System Configuration' : 'Configuración del Sistema'}
              </h2>
              <p className="text-slate-500 mt-2 max-w-2xl font-medium">
                {language === 'en' 
                  ? 'Orchestrate your sovereign intelligence parameters and organizational structure from a centralized command interface.' 
                  : 'Orqueste sus parámetros de inteligencia soberana y estructura organizacional desde una interfaz de comando centralizada.'}
              </p>
            </header>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-12 gap-8 pb-32">
              {/* Profile Settings (Large) */}
              <section className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold font-headline mb-1">{language === 'en' ? 'Administrative Profile' : 'Perfil Administrativo'}</h3>
                    <p className="text-sm text-slate-500 font-medium">{language === 'en' ? 'Manage your identity and security credentials' : 'Gestione su identidad y credenciales de seguridad'}</p>
                  </div>
                  <div className="relative group">
                    <div className="w-20 h-20 rounded-full border-4 border-slate-50 bg-primary-container flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                      {configData.admin_name?.substring(0, 2).toUpperCase() || 'AD'}
                    </div>
                    <button className="absolute bottom-0 right-0 bg-primary-container text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Full Name' : 'Nombre Completo'}</label>
                    <input 
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-container/20 font-bold text-slate-700" 
                      type="text" 
                      value={configData.admin_name}
                      onChange={e => setConfigData({...configData, admin_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Email Address' : 'Correo Electrónico'}</label>
                    <input 
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-container/20 font-bold text-slate-700" 
                      type="email" 
                      value={configData.admin_email}
                      onChange={e => setConfigData({...configData, admin_email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2 pt-4 border-t border-slate-50 mt-4">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">{language === 'en' ? 'Security Protocol' : 'Protocolo de Seguridad'}</label>
                    <div className="flex flex-wrap gap-4">
                      <button 
                        onClick={() => {
                          const section = document.getElementById('password-section');
                          if (section) section.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="flex items-center space-x-2 text-primary font-bold hover:bg-slate-50 px-4 py-2 rounded-xl transition-all"
                      >
                        <span className="material-symbols-outlined text-lg">lock_reset</span>
                        <span>{language === 'en' ? 'Initiate Password Rotation' : 'Iniciar Rotación de Contraseña'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* AI Intelligence Settings */}
              <section className="col-span-12 lg:col-span-4 bg-primary-container/5 rounded-3xl p-8 border border-primary-container/10">
                <div className="mb-8">
                  <span className="material-symbols-outlined text-primary-container text-4xl mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  <h3 className="text-xl font-bold font-headline mb-1">{language === 'en' ? 'AI Cognitive Engine' : 'Motor Cognitivo IA'}</h3>
                  <p className="text-sm text-slate-500 font-medium">{language === 'en' ? 'Fine-tune the intelligence threshold' : 'Ajuste el umbral de inteligencia'}</p>
                </div>
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Confidence Threshold' : 'Umbral de Confianza'}</label>
                      <span className="text-primary-container font-black">{(configData.confidence_threshold * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                      className="w-full h-1.5 bg-primary-container/10 rounded-lg appearance-none cursor-pointer accent-primary-container" 
                      type="range"
                      min="0.5"
                      max="0.99"
                      step="0.01"
                      value={configData.confidence_threshold}
                      onChange={e => setConfigData({...configData, confidence_threshold: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Neural Model Selection' : 'Selección de Modelo Neuronal'}</label>
                    <select 
                      className="w-full bg-white border border-slate-100 rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-primary-container/20 appearance-none"
                      value={configData.model_selection}
                      onChange={e => setConfigData({...configData, model_selection: e.target.value})}
                    >
                      <option>Sovereign-Alpha (Default)</option>
                      <option>GPT-4o Omniscience</option>
                      <option>Claude 3.5 Sonnet Precision</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-50">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-700">{language === 'en' ? 'Auto-Classification' : 'Auto-Clasificación'}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{language === 'en' ? 'Real-time intent labeling' : 'Etiquetado de intención en tiempo real'}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={configData.auto_classification}
                        onChange={e => setConfigData({...configData, auto_classification: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                    </label>
                  </div>
                </div>
              </section>

              {/* AI Provider API Keys Configuration */}
              <section className="col-span-12 lg:col-span-5 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-50 flex items-center justify-center rounded-xl">
                    <span className="material-symbols-outlined text-indigo-600">vpn_key</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-headline">{language === 'en' ? 'AI Provider' : 'Proveedor de IA'}</h3>
                    <p className="text-xs text-slate-500 font-medium">{language === 'en' ? 'Select and configure one active provider' : 'Seleccione y configure un proveedor activo'}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {/* OpenAI */}
                  <div 
                    onClick={() => { setSelectedAiProvider('openai'); setAiKeyStatus('idle'); }}
                    className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${selectedAiProvider === 'openai' ? 'border-[#10a37f] bg-[#10a37f]/5 shadow-md shadow-[#10a37f]/10' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedAiProvider === 'openai' ? 'border-[#10a37f]' : 'border-slate-300'}`}>
                          {selectedAiProvider === 'openai' && <div className="w-2.5 h-2.5 rounded-full bg-[#10a37f]" />}
                        </div>
                        <span className="text-sm font-bold text-slate-800">OpenAI (ChatGPT)</span>
                      </div>
                      {selectedAiProvider === 'openai' && configData.openai_key && aiKeyStatus === 'success' && (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          {language === 'en' ? 'Connected' : 'Conectado'}
                        </span>
                      )}
                    </div>
                    {selectedAiProvider === 'openai' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                        <div className="relative">
                          <input 
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 pr-10 text-xs font-mono font-bold text-slate-600 focus:ring-2 focus:ring-[#10a37f]/20 focus:border-[#10a37f]" 
                            type={showAiApiKey ? 'text' : 'password'} 
                            placeholder="sk-..."
                            value={configData.openai_key || ''}
                            onChange={e => { setConfigData({...configData, openai_key: e.target.value}); setAiKeyStatus('idle'); }}
                          />
                          <button type="button" onClick={(e) => { e.stopPropagation(); setShowAiApiKey(!showAiApiKey); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                            <span className="material-symbols-outlined text-base">{showAiApiKey ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Gemini */}
                  <div 
                    onClick={() => { setSelectedAiProvider('gemini'); setAiKeyStatus('idle'); }}
                    className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${selectedAiProvider === 'gemini' ? 'border-[#1a73e8] bg-[#1a73e8]/5 shadow-md shadow-[#1a73e8]/10' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedAiProvider === 'gemini' ? 'border-[#1a73e8]' : 'border-slate-300'}`}>
                          {selectedAiProvider === 'gemini' && <div className="w-2.5 h-2.5 rounded-full bg-[#1a73e8]" />}
                        </div>
                        <span className="text-sm font-bold text-slate-800">Google Gemini</span>
                      </div>
                      {selectedAiProvider === 'gemini' && configData.gemini_key && aiKeyStatus === 'success' && (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          {language === 'en' ? 'Connected' : 'Conectado'}
                        </span>
                      )}
                    </div>
                    {selectedAiProvider === 'gemini' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                        <div className="relative">
                          <input 
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 pr-10 text-xs font-mono font-bold text-slate-600 focus:ring-2 focus:ring-[#1a73e8]/20 focus:border-[#1a73e8]" 
                            type={showAiApiKey ? 'text' : 'password'} 
                            placeholder="AIzaSy..."
                            value={configData.gemini_key || ''}
                            onChange={e => { setConfigData({...configData, gemini_key: e.target.value}); setAiKeyStatus('idle'); }}
                          />
                          <button type="button" onClick={(e) => { e.stopPropagation(); setShowAiApiKey(!showAiApiKey); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                            <span className="material-symbols-outlined text-base">{showAiApiKey ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Groq */}
                  <div 
                    onClick={() => { setSelectedAiProvider('groq'); setAiKeyStatus('idle'); }}
                    className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${selectedAiProvider === 'groq' ? 'border-[#f55036] bg-[#f55036]/5 shadow-md shadow-[#f55036]/10' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedAiProvider === 'groq' ? 'border-[#f55036]' : 'border-slate-300'}`}>
                          {selectedAiProvider === 'groq' && <div className="w-2.5 h-2.5 rounded-full bg-[#f55036]" />}
                        </div>
                        <span className="text-sm font-bold text-slate-800">Groq</span>
                      </div>
                      {selectedAiProvider === 'groq' && configData.groq_key && aiKeyStatus === 'success' && (
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          {language === 'en' ? 'Connected' : 'Conectado'}
                        </span>
                      )}
                    </div>
                    {selectedAiProvider === 'groq' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                        <div className="relative">
                          <input 
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 pr-10 text-xs font-mono font-bold text-slate-600 focus:ring-2 focus:ring-[#f55036]/20 focus:border-[#f55036]" 
                            type={showAiApiKey ? 'text' : 'password'} 
                            placeholder="gsk_..."
                            value={configData.groq_key || ''}
                            onChange={e => { setConfigData({...configData, groq_key: e.target.value}); setAiKeyStatus('idle'); }}
                          />
                          <button type="button" onClick={(e) => { e.stopPropagation(); setShowAiApiKey(!showAiApiKey); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                            <span className="material-symbols-outlined text-base">{showAiApiKey ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Verify Button + Status */}
                <div className="mt-6 space-y-3">
                  <button 
                    onClick={handleVerifyAiKey}
                    disabled={aiKeyVerifying}
                    className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                      aiKeyStatus === 'success' 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                        : aiKeyStatus === 'error'
                          ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                          : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20'
                    }`}
                  >
                    {aiKeyVerifying ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {language === 'en' ? 'Verifying...' : 'Verificando...'}</>
                    ) : aiKeyStatus === 'success' ? (
                      <><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> {language === 'en' ? 'Verified' : 'Verificado'}</>
                    ) : aiKeyStatus === 'error' ? (
                      <><span className="material-symbols-outlined text-sm">error</span> {language === 'en' ? 'Verification Failed' : 'Verificaci\u00F3n Fallida'}</>
                    ) : (
                      <><span className="material-symbols-outlined text-sm">verified</span> {language === 'en' ? 'Verify Connection' : 'Verificar Conexi\u00F3n'}</>
                    )}
                  </button>
                  {aiKeyStatusMsg && aiKeyStatus !== 'idle' && (
                    <motion.p 
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className={`text-[10px] font-bold text-center ${aiKeyStatus === 'success' ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      {aiKeyStatusMsg}
                    </motion.p>
                  )}
                </div>

                {/* AI Status Indicator */}
                <div className={`mt-4 p-4 rounded-xl border flex items-center justify-between ${
                  aiCreditsStatus === 'active' ? 'bg-emerald-50 border-emerald-200' :
                  aiCreditsStatus === 'exhausted' ? 'bg-red-50 border-red-200' :
                  aiCreditsStatus === 'low' ? 'bg-amber-50 border-amber-200' :
                  aiCreditsStatus === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-slate-50 border-slate-100'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      aiCreditsStatus === 'active' ? 'bg-emerald-500 animate-pulse' :
                      aiCreditsStatus === 'exhausted' ? 'bg-red-500' :
                      aiCreditsStatus === 'low' ? 'bg-amber-500 animate-pulse' :
                      aiCreditsStatus === 'error' ? 'bg-red-500' :
                      'bg-slate-300'
                    }`} />
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${
                        aiCreditsStatus === 'active' ? 'text-emerald-700' :
                        aiCreditsStatus === 'exhausted' ? 'text-red-700' :
                        aiCreditsStatus === 'error' ? 'text-red-700' :
                        'text-slate-400'
                      }`}>
                        {language === 'en' ? 'AI Status' : 'Estado de IA'}
                      </p>
                      <p className={`text-xs font-medium ${
                        aiCreditsStatus === 'active' ? 'text-emerald-600' :
                        aiCreditsStatus === 'exhausted' ? 'text-red-600' :
                        aiCreditsStatus === 'error' ? 'text-red-600' :
                        'text-slate-400'
                      }`}>
                        {aiCreditsMsg || (language === 'en' ? 'Click verify to check status' : 'Haz clic en verificar para ver estado')}
                      </p>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-lg ${
                    aiCreditsStatus === 'active' ? 'text-emerald-500' :
                    aiCreditsStatus === 'exhausted' ? 'text-red-500' :
                    aiCreditsStatus === 'error' ? 'text-red-500' :
                    'text-slate-300'
                  }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {aiCreditsStatus === 'active' ? 'check_circle' :
                     aiCreditsStatus === 'exhausted' ? 'error' :
                     aiCreditsStatus === 'error' ? 'warning' :
                     'radio_button_unchecked'}
                  </span>
                </div>
              </section>

              {/* WhatsApp Configuration */}
              <section className="col-span-12 lg:col-span-7 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                <div className="flex items-center space-x-3 mb-8">
                  <div className="w-10 h-10 bg-[#25D366]/10 flex items-center justify-center rounded-xl">
                    <span className="material-symbols-outlined text-[#128C7E]">settings_input_component</span>
                  </div>
                  <h3 className="text-xl font-bold font-headline">{language === 'en' ? 'WhatsApp API Gateway' : 'Pasarela API WhatsApp'}</h3>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Bearer API Token' : 'Token de API Portador'}</label>
                    <div className="flex gap-2">
                      <input 
                        className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-600" 
                        type="password" 
                        value={configData.whatsapp_token}
                        onChange={e => setConfigData({...configData, whatsapp_token: e.target.value})}
                      />
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(configData.whatsapp_token);
                        }}
                        className="bg-slate-100 p-3 rounded-xl hover:bg-slate-200 transition-colors text-slate-500"
                      >
                        <span className="material-symbols-outlined text-sm">content_copy</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Phone Number ID' : 'ID de N\u00FAmero de Tel\u00E9fono'}</label>
                      <input 
                        className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-600" 
                        type="text" 
                        value={configData.whatsapp_phone_id}
                        onChange={e => setConfigData({...configData, whatsapp_phone_id: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Account Status' : 'Estado de Cuenta'}</label>
                      <div className={`h-full min-h-[44px] flex items-center px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                        waStatus === 'success' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : waStatus === 'error' 
                            ? 'bg-red-50 text-red-600 border-red-100'
                            : 'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>
                        {waStatus === 'success' ? (
                          <><span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span> {language === 'en' ? 'Verified Active' : 'Verificado Activo'}</>
                        ) : waStatus === 'error' ? (
                          <><span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span> {language === 'en' ? 'Connection Failed' : 'Conexi\u00F3n Fallida'}</>
                        ) : (
                          <><span className="w-2 h-2 bg-slate-300 rounded-full mr-2"></span> {language === 'en' ? 'Not Verified' : 'No Verificado'}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-slate-50">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Webhook Intelligence URL' : 'URL de Inteligencia Webhook'}</label>
                    <div className="flex gap-2">
                      <input 
                        className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-[11px] font-bold text-slate-400" 
                        type="text" 
                        readOnly 
                        value={`https://api.rifx-sovereign.io/hooks/v1/wa/${configData.whatsapp_phone_id || 'ID'}`} 
                      />
                    </div>
                  </div>
                  {/* Verify WhatsApp Button */}
                  <div className="pt-2 space-y-3">
                    <button 
                      onClick={handleVerifyWhatsApp}
                      disabled={waVerifying}
                      className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                        waStatus === 'success' 
                          ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/20' 
                          : waStatus === 'error'
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                            : 'bg-[#128C7E] text-white hover:bg-[#075E54] shadow-lg shadow-[#128C7E]/20'
                      }`}
                    >
                      {waVerifying ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {language === 'en' ? 'Verifying...' : 'Verificando...'}</>
                      ) : waStatus === 'success' ? (
                        <><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> {language === 'en' ? 'Connection Verified' : 'Conexi\u00F3n Verificada'}</>
                      ) : waStatus === 'error' ? (
                        <><span className="material-symbols-outlined text-sm">error</span> {language === 'en' ? 'Verification Failed' : 'Verificaci\u00F3n Fallida'}</>
                      ) : (
                        <><span className="material-symbols-outlined text-sm">verified</span> {language === 'en' ? 'Verify WhatsApp Connection' : 'Verificar Conexi\u00F3n WhatsApp'}</>
                      )}
                    </button>
                    {waStatusMsg && waStatus !== 'idle' && (
                      <motion.p 
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className={`text-[10px] font-bold text-center ${waStatus === 'success' ? 'text-emerald-600' : 'text-red-500'}`}
                      >
                        {waStatusMsg}
                      </motion.p>
                    )}
                  </div>
                </div>
              </section>

              {/* Bulk WhatsApp Number for Mass Messaging */}
              <section className="col-span-12 lg:col-span-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-8 border border-amber-200/50 shadow-sm">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-amber-500/10 flex items-center justify-center rounded-xl">
                    <span className="material-symbols-outlined text-amber-600" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-headline">{language === 'en' ? 'Bulk Messaging Number' : 'N\u00FAmero para Masivos'}</h3>
                    <p className="text-[10px] text-amber-700/70 font-medium">{language === 'en' ? 'Separate number to protect your main bot' : 'N\u00FAmero separado para proteger tu bot principal'}</p>
                  </div>
                </div>
                <div className="space-y-5">
                  <div className="p-3 bg-amber-100/50 rounded-xl border border-amber-200/50">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-amber-600 text-sm mt-0.5">info</span>
                      <p className="text-[10px] text-amber-800 leading-relaxed">
                        {language === 'en' 
                          ? 'Configure a second WhatsApp number exclusively for bulk messaging. This protects your main bot number from potential blocks.'
                          : 'Configura un segundo n\u00FAmero de WhatsApp exclusivo para env\u00EDos masivos. Esto protege tu n\u00FAmero principal del bot de posibles bloqueos.'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-amber-700/60">Token API Masivos</label>
                    <input 
                      className="w-full bg-white border border-amber-200/50 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-600 focus:ring-2 focus:ring-amber-300/30 focus:border-amber-300" 
                      type="password" 
                      placeholder={language === 'en' ? 'Bearer token for bulk number...' : 'Token de API para n\u00FAmero masivo...'}
                      value={configData.bulk_wa_token || ''}
                      onChange={e => setConfigData({...configData, bulk_wa_token: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-amber-700/60">Phone Number ID Masivos</label>
                    <input 
                      className="w-full bg-white border border-amber-200/50 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-amber-300/30 focus:border-amber-300" 
                      type="text" 
                      placeholder={language === 'en' ? 'Phone Number ID for bulk...' : 'ID de tel\u00E9fono para masivos...'}
                      value={configData.bulk_wa_phone_id || ''}
                      onChange={e => setConfigData({...configData, bulk_wa_phone_id: e.target.value})}
                    />
                  </div>
                  <div className={`flex items-center px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                    configData.bulk_wa_token && configData.bulk_wa_phone_id
                      ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-slate-50 text-slate-400 border-slate-100'
                  }`}>
                    <span className={`w-2 h-2 rounded-full mr-2 ${configData.bulk_wa_token && configData.bulk_wa_phone_id ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></span>
                    {configData.bulk_wa_token && configData.bulk_wa_phone_id
                      ? (language === 'en' ? 'Bulk number configured' : 'N\u00FAmero masivo configurado')
                      : (language === 'en' ? 'Not configured — will use main number' : 'No configurado — usar\u00E1 n\u00FAmero principal')}
                  </div>
                </div>
              </section>
              <section className="col-span-12 lg:col-span-5 bg-slate-50 rounded-3xl p-8 border border-slate-100 shadow-sm">
                <h3 className="text-xl font-bold font-headline mb-6">{language === 'en' ? 'Alert Dispatcher' : 'Despachador de Alertas'}</h3>
                
                {/* Email for notifications */}
                <div className="mb-6">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{language === 'en' ? 'Notification Email' : 'Correo de Notificaciones'}</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="material-symbols-outlined text-slate-400 text-base">mail</span>
                    </span>
                    <input 
                      type="email" 
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 placeholder-slate-300 focus:outline-none focus:border-primary-container/30 focus:ring-2 focus:ring-primary-container/10 transition-all" 
                      placeholder="alertas@ejemplo.com"
                      value={configData.alert_email || ''}
                      onChange={e => setConfigData({...configData, alert_email: e.target.value})}
                    />
                    {configData.alert_email && (
                      <span className="absolute inset-y-0 right-0 pr-4 flex items-center">
                        <span className="material-symbols-outlined text-emerald-500 text-sm" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1.5 font-medium">
                    {language === 'en' 
                      ? 'Errors and critical alerts will be sent to this email' 
                      : 'Los errores y alertas cr\u00EDticas se enviar\u00E1n a este correo'}
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    { key: 'email_alerts', icon: 'mail', label: language === 'en' ? 'Critical Email Alerts' : 'Alertas Cr\u00EDticas por Email' },
                    { key: 'push_notifications', icon: 'notifications_active', label: language === 'en' ? 'Real-time Push Notifications' : 'Notificaciones Push' },
                    { key: 'daily_briefing', icon: 'summarize', label: language === 'en' ? 'Daily Intelligence Briefing' : 'Resumen de Inteligencia Diario' }
                  ].map(alert => (
                    <div key={alert.key} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                      <div className="flex items-center space-x-3">
                        <span className="material-symbols-outlined text-slate-400 text-lg">{alert.icon}</span>
                        <span className="text-xs font-bold text-slate-700">{alert.label}</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={configData[alert.key]}
                          onChange={e => setConfigData({...configData, [alert.key]: e.target.checked})}
                        />
                        <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
                      </label>
                    </div>
                  ))}
                </div>
                <div className="mt-8 p-4 border border-dashed border-slate-200 rounded-2xl bg-white/50">
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                    <span className="font-black text-primary uppercase mr-1">Pro Tip:</span> 
                    {language === 'en' 
                      ? 'System-level alerts bypass these settings and will always be delivered to the primary account email.' 
                      : 'Las alertas a nivel de sistema ignoran estas configuraciones y siempre se enviar\u00E1n al correo principal.'}
                  </p>
                </div>
              </section>

              {/* Memory Management */}
              <section className="col-span-12 lg:col-span-7 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-orange-50 flex items-center justify-center rounded-xl">
                    <span className="material-symbols-outlined text-orange-500">psychology</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-headline">{language === 'en' ? 'Memory Management' : 'Gesti\u00F3n de Memoria'}</h3>
                    <p className="text-xs text-slate-500 font-medium">{language === 'en' ? 'Control AI conversation memory retention' : 'Controle la retenci\u00F3n de memoria de conversaciones IA'}</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {/* Memory Usage Bar */}
                  {(() => {
                    const maxMessages = 10000; // Capacity limit for visualization
                    const usagePercent = Math.min(100, Math.round((memoryUsage.totalMessages / maxMessages) * 100));
                    const isWarning = usagePercent >= 70;
                    const isCritical = usagePercent >= 90;
                    return (
                      <div className={`p-4 rounded-xl border ${isCritical ? 'bg-red-50 border-red-200' : isWarning ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-500'}`}>
                            {language === 'en' ? 'Memory Capacity' : 'Capacidad de Memoria'}
                          </span>
                          <span className={`text-xs font-bold ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-600'}`}>
                            {usagePercent}%
                          </span>
                        </div>
                        <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-slate-200">
                          <div 
                            className={`h-full rounded-full transition-all duration-700 ${isCritical ? 'bg-gradient-to-r from-red-400 to-red-600' : isWarning ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-4">
                            <span className="text-[9px] text-slate-500 font-medium flex items-center gap-1">
                              <span className="material-symbols-outlined text-[10px]">chat</span>
                              {memoryUsage.totalMessages.toLocaleString()} {language === 'en' ? 'messages' : 'mensajes'}
                            </span>
                            <span className="text-[9px] text-slate-500 font-medium flex items-center gap-1">
                              <span className="material-symbols-outlined text-[10px]">people</span>
                              {memoryUsage.totalConversations} {language === 'en' ? 'conversations' : 'conversaciones'}
                            </span>
                          </div>
                          {isCritical && (
                            <span className="text-[9px] font-bold text-red-600 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[10px]">warning</span>
                              {language === 'en' ? 'Almost full!' : '\u00A1Casi llena!'}
                            </span>
                          )}
                          {isWarning && !isCritical && (
                            <span className="text-[9px] font-bold text-amber-600 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[10px]">info</span>
                              {language === 'en' ? 'Getting full' : 'Llen\u00E1ndose'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Retention Period Selector */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Auto-Delete After' : 'Eliminar Autom\u00E1ticamente Despu\u00E9s De'}</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: 7, label: '7 d\u00EDas' },
                        { value: 15, label: '15 d\u00EDas' },
                        { value: 30, label: '30 d\u00EDas' },
                        { value: 90, label: '90 d\u00EDas' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => { setMemoryRetentionDays(opt.value); setConfigData({...configData, media_retention_days: opt.value}); }}
                          className={`py-3 rounded-xl text-xs font-bold transition-all ${
                            (configData.media_retention_days || memoryRetentionDays) === opt.value
                              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {language === 'en' 
                        ? `Conversations older than ${configData.media_retention_days || memoryRetentionDays} days will be automatically purged.`
                        : `Las conversaciones con m\u00E1s de ${configData.media_retention_days || memoryRetentionDays} d\u00EDas se purgar\u00E1n autom\u00E1ticamente.`}
                    </p>
                  </div>

                  {/* Manual Clear */}
                  <div className="pt-4 border-t border-slate-50 space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Manual Memory Reset' : 'Reinicio Manual de Memoria'}</label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handleClearMemory}
                        disabled={memoryClearing}
                        className={`flex-1 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                          memoryClearSuccess 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                            : 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'
                        }`}
                      >
                        {memoryClearing ? (
                          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {language === 'en' ? 'Clearing...' : 'Limpiando...'}</>
                        ) : memoryClearSuccess ? (
                          <><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> {language === 'en' ? 'Memory Cleared!' : '\u00A1Memoria Borrada!'}</>
                        ) : (
                          <><span className="material-symbols-outlined text-sm">delete_forever</span> {language === 'en' ? 'Clear All Memory Now' : 'Borrar Toda la Memoria Ahora'}</>
                        )}
                      </button>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <p className="text-[10px] text-amber-700 font-medium flex items-start gap-2">
                        <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">warning</span>
                        {language === 'en' 
                          ? 'This action will permanently delete all cached conversations, inference history, and AI context. This cannot be undone.'
                          : 'Esta acci\u00F3n eliminar\u00E1 permanentemente todas las conversaciones en cach\u00E9, el historial de inferencia y el contexto de IA. No se puede deshacer.'}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Password Section (Integrated into the Bento Grid) */}
              <section id="password-section" className="col-span-12 bg-white rounded-3xl p-8 border border-slate-100 shadow-sm scroll-mt-20">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-50">
                  <span className="material-symbols-outlined text-emerald-500">lock</span>
                  <h3 className="text-xl font-bold font-headline">{language === 'en' ? 'Sovereign Credentials' : 'Credenciales Soberanas'}</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Current Access Key' : 'Llave de Acceso Actual'}</label>
                    <input 
                      type="password" 
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'New Intelligence Key' : 'Nueva Llave de Inteligencia'}</label>
                    <input 
                      type="password" 
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Verify New Key' : 'Verificar Nueva Llave'}</label>
                    <input 
                      type="password" 
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500/20" 
                    />
                  </div>
                </div>
                
                <div className="mt-8 flex items-center justify-between">
                  <p className="text-xs text-slate-400 font-medium max-w-md">
                    {language === 'en' 
                      ? 'Rotating your credentials regularly ensures maximum sovereignty over your intelligence assets.' 
                      : 'Rotar sus credenciales regularmente garantiza la máxima soberanía sobre sus activos de inteligencia.'}
                  </p>
                  <button 
                    onClick={handleChangePassword}
                    disabled={changingPassword || !newPassword}
                    className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {changingPassword ? '...' : (language === 'en' ? 'Update Access Protocol' : 'Actualizar Protocolo de Acceso')}
                  </button>
                </div>
                {passwordError && <p className="mt-4 text-[10px] font-black text-red-500 uppercase tracking-widest">{passwordError}</p>}
                {passwordSuccess && <p className="mt-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest">{language === 'en' ? 'Credentials successfully rotated!' : '¡Credenciales rotadas con éxito!'}</p>}
              </section>
            </div>

            {/* Sticky Action Bar */}
            <div className="fixed bottom-10 right-10 flex items-center gap-4 z-50">
              <AnimatePresence>
                {showSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm"
                  >
                    <span className="material-symbols-outlined">check_circle</span>
                    {language === 'en' ? 'Parameters synchronized successfully!' : '¡Parámetros sincronizados con éxito!'}
                  </motion.div>
                )}
                {saveError && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="bg-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm"
                  >
                    <span className="material-symbols-outlined">error</span>
                    {saveError}
                  </motion.div>
                )}
              </AnimatePresence>
              
              <button 
                onClick={discardChanges}
                className="px-8 py-4 bg-white text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl hover:bg-slate-50 transition-all active:scale-95 border border-slate-100"
              >
                {language === 'en' ? 'Discard Changes' : 'Descartar Cambios'}
              </button>
              <button 
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="px-10 py-4 bg-gradient-to-br from-primary-container to-primary text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-[0_12px_24px_rgba(0,0,128,0.3)] hover:opacity-90 transition-all active:scale-95 flex items-center gap-3"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-sm">sync_saved_locally</span>
                )}
                {language === 'en' ? 'Apply Parameters' : 'Aplicar Parámetros'}
              </button>
            </div>
          </motion.div>
        )}



        {/* Other tabs Coming Soon placeholders can be moved here if needed, 
            but the redundant dashboard block must be removed. */}
        {activeTab === 'playground' && (
          <motion.div key="playground" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-10">
            {/* Header */}
            <header className="max-w-4xl">
              <div className="flex items-center space-x-4 mb-4">
                <span className="px-3 py-1 bg-secondary-container text-primary text-[10px] font-black tracking-widest uppercase rounded-full">System v2.4</span>
                <span className="text-slate-300 text-xs">{'\u2022'}</span>
                <span className="text-slate-400 text-xs font-medium">{language === 'en' ? 'Last saved: ' : '{"\u00DA"}ltimo guardado: '}{showSuccess ? (language === 'en' ? 'Just now' : 'Ahora mismo') : (language === 'en' ? '2 minutes ago' : 'hace 2 minutos')}</span>
              </div>
              <h2 className="text-5xl font-extrabold text-primary mb-6 tracking-tight leading-tight font-headline">{language === 'en' ? 'AI Bot Configuration' : 'Configuraci\u00F3n del Bot IA'}</h2>
              <p className="text-xl text-slate-500 max-w-2xl font-normal leading-relaxed">{language === 'en' ? 'Refine the intelligence, personality, and operational logic of your Sovereign AI agent.' : 'Refine la inteligencia, personalidad y l\u00F3gica operacional de su agente de IA Soberano.'}</p>
            </header>

            <div className="grid grid-cols-12 gap-8">
              {/* Left Column */}
              <div className="col-span-12 lg:col-span-7 space-y-8">
                {/* Identity & Tone */}
                <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-primary-container mb-6 flex items-center"><span className="material-symbols-outlined text-lg mr-2">psychology</span>{language === 'en' ? 'Identity & Tone' : 'Identidad y Tono'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">{language === 'en' ? 'Bot Name' : 'Nombre del Bot'}</label>
                      <input className="w-full bg-slate-50 border-none rounded-xl p-3 text-primary font-bold focus:ring-2 focus:ring-primary-container/20 transition-all" type="text" value={botName} onChange={e => setBotName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">{language === 'en' ? 'Role Description' : 'Descripci\u00F3n del Rol'}</label>
                      <input className="w-full bg-slate-50 border-none rounded-xl p-3 text-slate-700 focus:ring-2 focus:ring-primary-container/20 transition-all" placeholder={language === 'en' ? 'e.g. Senior Support Specialist' : 'ej. Especialista Senior de Soporte'} type="text" value={botRole} onChange={e => setBotRole(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">{language === 'en' ? 'Communication Tone' : 'Tono de Comunicaci\u00F3n'}</label>
                      <select className="w-full bg-slate-50 border-none rounded-xl p-3 text-primary font-bold focus:ring-2 focus:ring-primary-container/20" value={botTone} onChange={e => setBotTone(e.target.value)}>
                        <option value="Profesional">{language === 'en' ? 'Professional' : 'Profesional'}</option>
                        <option value="Amigable">{language === 'en' ? 'Friendly' : 'Amigable'}</option>
                        <option value="Directo">{language === 'en' ? 'Direct' : 'Directo'}</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* Model Settings & Knowledge Base Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Model Settings */}
                  <section className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary-container mb-6">{language === 'en' ? 'Model Configuration' : 'Configuraci\u00F3n del Modelo'}</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">{language === 'en' ? 'AI Provider' : 'Proveedor de IA'}</label>
                        <select className="w-full bg-white border-none rounded-xl p-3 text-sm font-bold text-primary focus:ring-2 focus:ring-primary-container/20 shadow-sm" value={botModelSelected} onChange={e => setBotModelSelected(e.target.value)}>
                          <optgroup label="OpenAI">
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                            <option value="gpt-4-turbo">GPT-4 Turbo</option>
                          </optgroup>
                          <optgroup label="Google Gemini">
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                          </optgroup>
                          <optgroup label="Groq">
                            <option value="llama-3.3-70b">Llama 3.3 70B (Groq)</option>
                            <option value="mixtral-8x7b">Mixtral 8x7B (Groq)</option>
                          </optgroup>
                          <optgroup label="Anthropic">
                            <option value="claude-sonnet-4">Claude Sonnet 4</option>
                            <option value="claude-haiku">Claude Haiku</option>
                          </optgroup>
                          <optgroup label="Meta (Llama)">
                            <option value="llama-3.1-405b">Llama 3.1 405B</option>
                          </optgroup>
                        </select>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
                        <span className="material-symbols-outlined text-primary-container text-lg">bolt</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-black text-primary block truncate">{botModelSelected}</span>
                          <span className="text-[10px] text-slate-400">{language === 'en' ? 'Active model' : 'Modelo activo'}</span>
                        </div>
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{language === 'en' ? 'Temperature' : 'Temperatura'}</label>
                          <span className="text-[10px] font-black text-primary">{botTemperature.toFixed(1)}</span>
                        </div>
                        <input className="w-full accent-primary-container h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer" type="range" min="0" max="1" step="0.1" value={botTemperature} onChange={e => setBotTemperature(parseFloat(e.target.value))} />
                        <div className="flex justify-between mt-1"><span className="text-[9px] text-slate-400">{language === 'en' ? 'Precise' : 'Preciso'}</span><span className="text-[9px] text-slate-400">{language === 'en' ? 'Creative' : 'Creativo'}</span></div>
                      </div>
                    </div>
                  </section>

                  {/* Knowledge Base */}
                  <section className="bg-slate-50 p-8 rounded-3xl border border-slate-100 flex flex-col">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary-container mb-6 flex justify-between items-center">
                      {language === 'en' ? 'Knowledge Base' : 'Base de Conocimiento'}
                      <button onClick={() => botKbFileRef.current?.click()} className="text-primary-container hover:opacity-70 transition-opacity" title={language === 'en' ? 'Upload file' : 'Subir archivo'}><span className="material-symbols-outlined text-lg">upload_file</span></button>
                    </h3>
                    <input ref={botKbFileRef} type="file" accept=".pdf,.csv,.txt,.doc,.docx" multiple className="hidden" onChange={e => { const files = e.target.files; if (files) { Array.from(files).forEach(f => { const ext = f.name.split('.').pop()?.toLowerCase() || 'txt'; const size = f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`; setBotKnowledgeFiles(prev => [...prev, { name: f.name, type: ext, size, active: true }]); }); e.target.value = ''; }}} />
                    <div className="space-y-3 overflow-y-auto max-h-48 pr-1 flex-1">
                      {botKnowledgeFiles.map((file, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl flex items-center justify-between group shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
                          <div className="flex items-center space-x-3 overflow-hidden flex-1">
                            <span className="material-symbols-outlined text-lg" style={{ color: file.type === 'pdf' ? '#dc2626' : file.type === 'csv' ? '#16a34a' : '#3b82f6' }}>{file.type === 'pdf' ? 'picture_as_pdf' : file.type === 'csv' ? 'table_chart' : 'description'}</span>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-700 truncate block">{file.name}</span>
                              <span className="text-[9px] text-slate-400">{file.size}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setBotKnowledgeFiles(prev => prev.filter((_, i) => i !== idx))} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"><span className="material-symbols-outlined text-sm">delete</span></button>
                            <button onClick={() => setBotKnowledgeFiles(prev => prev.map((f, i) => i === idx ? { ...f, active: !f.active } : f))} className={`w-8 h-4 rounded-full relative transition-colors ${file.active ? 'bg-emerald-500' : 'bg-slate-300'}`}><div className={`absolute top-[2px] w-3 h-3 bg-white rounded-full shadow-sm transition-all ${file.active ? 'right-[2px]' : 'left-[2px]'}`} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Drop zone */}
                    <button onClick={() => botKbFileRef.current?.click()} className="mt-4 w-full border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-primary-container/40 hover:bg-primary-container/5 transition-all cursor-pointer group">
                      <span className="material-symbols-outlined text-slate-300 group-hover:text-primary-container text-2xl">cloud_upload</span>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">{language === 'en' ? 'Drop or click to upload PDF, CSV, TXT' : 'Arrastra o haz clic para subir PDF, CSV, TXT'}</p>
                    </button>
                  </section>
                </div>

                {/* Prompt Architecture */}
                <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary-container flex items-center gap-2"><span className="material-symbols-outlined text-lg">code</span>{language === 'en' ? 'System Instruction Architecture' : 'Arquitectura de Instrucciones del Sistema'}</label>
                    <span className="text-[10px] bg-primary-container/10 text-primary-container px-2.5 py-1 rounded-full font-black">V 2.4.1</span>
                  </div>
                  <div className="relative">
                    <textarea className="w-full bg-slate-50/50 border border-slate-100 rounded-xl p-6 font-mono text-xs leading-relaxed focus:ring-2 focus:ring-primary-container/20 focus:outline-none transition-all text-slate-700" placeholder={language === 'en' ? 'Enter system instructions...' : 'Ingresa las instrucciones del sistema...'} rows={10} value={configData.ai_prompt} onChange={e => setConfigData({...configData, ai_prompt: e.target.value})} />
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(configData.ai_prompt)} className="bg-white border border-slate-100 p-2.5 rounded-lg hover:bg-slate-50 transition-colors text-slate-400 hover:text-primary shadow-sm"><span className="material-symbols-outlined text-sm">content_copy</span></button>
                      <button onClick={(e) => handleSaveSettings(e as any)} disabled={isSaving} className="bg-primary-container text-white p-2.5 rounded-lg hover:bg-primary-container/90 transition-colors shadow-lg shadow-primary-container/20 disabled:opacity-50"><span className="material-symbols-outlined text-sm">{isSaving ? 'sync' : 'save'}</span></button>
                    </div>
                  </div>
                </section>

                {/* Safety & Guardrails */}
                <section className="relative overflow-hidden p-8 rounded-3xl bg-primary-container/5 backdrop-blur-xl border border-primary-container/10 shadow-sm">
                  <div className="relative z-10">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary-container mb-8 flex items-center gap-2"><span className="material-symbols-outlined text-lg">shield</span>{language === 'en' ? 'Safety & Guardrails' : 'Seguridad y Protecciones'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { key: 'handoff', icon: 'support_agent', label: language === 'en' ? 'Human Handoff' : 'Derivar a Humano', desc: language === 'en' ? 'Triggers operator when bot confidence is < 40%' : 'Activa operador cuando la confianza del bot es menor al 40%', state: botHumanHandoff, setter: setBotHumanHandoff },
                        { key: 'profanity', icon: 'block', label: language === 'en' ? 'Profanity Filter' : 'Filtro de Lenguaje', desc: language === 'en' ? 'Blocks explicit language in bidirectional flow' : 'Bloquea lenguaje expl\u00EDcito en flujo bidireccional', state: botProfanityFilter, setter: setBotProfanityFilter },
                        { key: 'topic', icon: 'lock', label: language === 'en' ? 'Topic Locks' : 'Bloqueo de Temas', desc: language === 'en' ? 'Restricts conversation to product domain only' : 'Restringe la conversaci\u00F3n solo al dominio del producto', state: botTopicLocks, setter: setBotTopicLocks },
                      ].map((guard, idx) => (
                        <div key={guard.key} className={`p-4 rounded-2xl transition-all ${guard.state ? 'bg-white shadow-sm border border-primary-container/10' : 'bg-white/40 border border-transparent'}`}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${guard.state ? 'bg-primary-container text-white' : 'bg-slate-200 text-slate-400'}`}><span className="material-symbols-outlined text-sm">{guard.icon}</span></div>
                            <span className="text-xs font-black text-primary flex-1">{guard.label}</span>
                            <button onClick={() => guard.setter(!guard.state)} className={`w-10 h-5 rounded-full relative transition-colors ${guard.state ? 'bg-primary-container' : 'bg-slate-300'}`}><div className={`absolute top-[3px] w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-all ${guard.state ? 'right-[3px]' : 'left-[3px]'}`} /></button>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{guard.desc}</p>
                          {guard.state && <div className="mt-3 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /><span className="text-[9px] font-black text-emerald-600 uppercase">{language === 'en' ? 'Active' : 'Activo'}</span></div>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 blur-3xl rounded-full translate-x-10 -translate-y-10" />
                </section>
              </div>

              {/* Right Column: Chat Preview */}
              <div className="col-span-12 lg:col-span-5">
                <div className="bg-white rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-slate-100 sticky top-24 max-h-[620px]">
                  {/* Chat Header */}
                  <div className="bg-gradient-to-r from-primary to-primary-container p-6 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/10"><span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span></div>
                      <div>
                        <h4 className="text-white font-bold text-sm">{botName || 'Bot'}</h4>
                        <div className="flex items-center space-x-2">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                          <span className="text-[10px] text-white/70 font-bold">{language === 'en' ? 'Online' : 'En l\u00EDnea'} {'\u2022'} {botModelSelected}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => { 
                          setBotPreviewMessages([{ role: 'bot', content: language === 'en' ? `Hello! I'm ${botName}. How can I assist you?` : `\u00A1Hola! Soy ${botName}. \u00BFEn qu\u00E9 puedo ayudarte?`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
                          setTestHistory([]); // Clear inference history
                        }} 
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-lg text-white/80 hover:text-white hover:bg-red-500/20 hover:text-red-300 transition-all text-[10px] font-bold uppercase tracking-wider group"
                        title={language === 'en' ? 'Clear Memory' : 'Borrar Memoria'}
                      >
                        <span className="material-symbols-outlined text-sm group-hover:hidden">delete_outline</span>
                        <span className="material-symbols-outlined text-sm hidden group-hover:block">delete</span>
                        <span className="hidden sm:block">{language === 'en' ? 'Clear Memory' : 'Borrar Memoria'}</span>
                      </button>
                      <button onClick={() => { setBotPreviewMessages([{ role: 'bot', content: language === 'en' ? `Hello! I'm ${botName}. How can I assist you?` : `\u00A1Hola! Soy ${botName}. \u00BFEn qu\u00E9 puedo ayudarte?`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]); }} className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all"><span className="material-symbols-outlined text-sm">refresh</span></button>
                    </div>
                  </div>
                  {/* Chat History */}
                  <div className="flex-1 p-5 space-y-4 overflow-y-auto bg-gradient-to-b from-slate-50/50 to-white min-h-0">
                    {botPreviewMessages.map((msg, idx) => (
                      <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                        {msg.role === 'bot' && <div className="w-7 h-7 bg-primary-container/10 rounded-full flex items-center justify-center flex-shrink-0 mb-1"><span className="material-symbols-outlined text-primary-container text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span></div>}
                        <div className={`max-w-[78%] ${msg.role === 'user' ? 'bg-primary-container text-white rounded-2xl rounded-br-md shadow-lg shadow-primary-container/20' : `bg-white text-slate-700 rounded-2xl rounded-bl-md shadow-sm border border-slate-100 ${msg.isKb ? 'border-l-[3px] border-l-amber-400' : ''}`} p-4`}>
                          {msg.isKb && <div className="flex items-center gap-1.5 mb-2 bg-amber-50 px-2 py-1 rounded-md w-fit"><span className="material-symbols-outlined text-amber-500 text-xs">auto_stories</span><span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">{language === 'en' ? 'From Knowledge Base' : 'Base de Conocimiento'}</span></div>}
                          <p className="text-[13px] leading-relaxed">{msg.content}</p>
                          <span className={`text-[9px] font-bold block mt-2 ${msg.role === 'user' ? 'text-right text-white/50' : 'text-slate-400'}`}>{msg.time}</span>
                        </div>
                        {msg.role === 'user' && <div className="w-7 h-7 bg-primary-container rounded-full flex items-center justify-center flex-shrink-0 mb-1"><span className="material-symbols-outlined text-white text-xs">person</span></div>}
                      </motion.div>
                    ))}
                    {isTestingAi && (
                      <div className="flex justify-start items-end gap-2">
                        <div className="w-7 h-7 bg-primary-container/10 rounded-full flex items-center justify-center flex-shrink-0"><span className="material-symbols-outlined text-primary-container text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span></div>
                        <div className="bg-white p-4 rounded-2xl rounded-bl-md shadow-sm border border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-primary-container rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-primary-container/60 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                            <div className="w-2 h-2 bg-primary-container/30 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Chat Input */}
                  <div className="p-4 bg-white border-t border-slate-100">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!botPreviewInput.trim() || isTestingAi) return;
                      const userMsg = botPreviewInput.trim();
                      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      setBotPreviewMessages(prev => [...prev, { role: 'user', content: userMsg, time: now }]);
                      setBotPreviewInput('');
                      setIsTestingAi(true);
                      try {
                        const res = await fetch('/api/panel/test-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg, history: botPreviewMessages.map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content })), botName, botRole, botTone, temperature: botTemperature, humanHandoff: botHumanHandoff, profanityFilter: botProfanityFilter, topicLocks: botTopicLocks }) });
                        const data = await res.json();
                        if (data.response) {
                          const respTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          setBotPreviewMessages(prev => [...prev, { role: 'bot', content: data.response, time: respTime, isKb: data.inference?.category === 'interesado' }]);
                          if (data.inference) { setLastInference(data.inference); setTestHistory(prev => [{ message: userMsg, inference: data.inference, timestamp: new Date().toISOString() }, ...prev]); }
                        }
                      } catch (err) { console.error(err); }
                      finally { setIsTestingAi(false); }
                    }} className="flex items-center gap-3">
                      <div className="flex-1 relative">
                        <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-5 pr-4 text-sm focus:ring-2 focus:ring-primary-container/20 focus:border-primary-container/30 transition-all" placeholder={language === 'en' ? 'Type a message...' : 'Escribe un mensaje...'} type="text" value={botPreviewInput} onChange={e => setBotPreviewInput(e.target.value)} />
                      </div>
                      <button type="submit" disabled={!botPreviewInput.trim() || isTestingAi} className="w-11 h-11 bg-primary-container text-white rounded-2xl flex items-center justify-center active:scale-90 transition-all disabled:opacity-30 shadow-lg shadow-primary-container/20 hover:shadow-xl hover:shadow-primary-container/30"><span className="material-symbols-outlined text-lg">send</span></button>
                    </form>
                    <p className="text-[9px] text-center text-slate-400 mt-3 font-medium">{language === 'en' ? 'Real-time preview updates as you modify settings' : 'Vista previa en tiempo real al modificar la configuraci\u00F3n'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Playground Config */}
            <div className="flex items-center justify-between bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary-container text-xl">save</span>
                <div>
                  <p className="text-sm font-bold text-slate-700">{language === 'en' ? 'Save Configuration' : 'Guardar Configuraci\u00F3n'}</p>
                  <p className="text-[10px] text-slate-400">{language === 'en' ? 'Persist your bot personality and security settings' : 'Guarda la personalidad y seguridad de tu bot'}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  try {
                    const playgroundConfig = { botName, botRole, botTone, botTemperature, botHumanHandoff, botProfanityFilter, botTopicLocks };
                    localStorage.setItem('rifx_playground_config', JSON.stringify(playgroundConfig));
                    setShowSuccess(true);
                    setTimeout(() => setShowSuccess(false), 3000);
                  } catch (e) { console.error(e); }
                }}
                className="px-8 py-3 bg-gradient-to-br from-primary-container to-primary text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-primary-container/20 hover:opacity-90 transition-all active:scale-95 flex items-center gap-2"
              >
                {showSuccess ? (
                  <><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span> {language === 'en' ? 'Saved!' : '\u00A1Guardado!'}</>
                ) : (
                  <><span className="material-symbols-outlined text-sm">save</span> {language === 'en' ? 'Save Changes' : 'Guardar Cambios'}</>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'segments' && (
          <motion.div
            key="segments"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-10"
          >
            {/* Header Section */}
            <header className="flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-extrabold tracking-tight text-primary font-headline mb-2">
                  {language === 'en' ? 'Audience Segments' : 'Segmentos de Audiencia'}
                </h2>
                <p className="text-slate-500 font-medium">
                  {language === 'en' ? 'Orchestrate your audience and AI classification rules.' : 'Orquestación de audiencia y reglas de clasificación por IA.'}
                </p>
              </div>
              <div className="flex gap-3">
                <button className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                  <span className="material-symbols-outlined text-sm">filter_list</span>
                  {language === 'en' ? 'Filter' : 'Filtrar'}
                </button>
                <button className="px-5 py-2.5 bg-primary-container text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-primary-container/20">
                  <span className="material-symbols-outlined text-sm">add</span>
                  {language === 'en' ? 'New Segment' : 'Nuevo Segmento'}
                </button>
              </div>
            </header>

            {/* Bento Grid Section: Overview Cards */}
            <section className="grid grid-cols-12 gap-6">
              {/* Stat Card: Interesados */}
              <div className="col-span-12 md:col-span-4 bg-white p-8 rounded-2xl flex flex-col justify-between hover:shadow-xl hover:shadow-slate-200/50 transition-all border-l-4 border-emerald-500 shadow-sm group">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {language === 'en' ? 'High Intent' : 'Alto Interés'}
                  </span>
                </div>
                <div>
                  <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                    {language === 'en' ? 'Interested' : 'Interesados'}
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-primary font-headline tracking-tighter">
                      {conversationsData?.interested?.length || 0}
                    </span>
                    <span className="text-slate-400 text-sm font-medium">{language === 'en' ? 'leads' : 'prospectos'}</span>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-50">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(100, ((conversationsData?.interested?.length || 0) / (allContacts.length || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Stat Card: Indecisos */}
              <div className="col-span-12 md:col-span-4 bg-white p-8 rounded-2xl flex flex-col justify-between hover:shadow-xl hover:shadow-slate-200/50 transition-all border-l-4 border-amber-500 shadow-sm group">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>pending</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {language === 'en' ? 'Medium Intent' : 'Interés Medio'}
                  </span>
                </div>
                <div>
                  <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                    {language === 'en' ? 'Undecided' : 'Indecisos'}
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-primary font-headline tracking-tighter">
                      {conversationsData?.chatting?.length || 0}
                    </span>
                    <span className="text-slate-400 text-sm font-medium">{language === 'en' ? 'leads' : 'prospectos'}</span>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-50">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(100, ((conversationsData?.chatting?.length || 0) / (allContacts.length || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Stat Card: Curiosos */}
              <div className="col-span-12 md:col-span-4 bg-white p-8 rounded-2xl flex flex-col justify-between hover:shadow-xl hover:shadow-slate-200/50 transition-all border-l-4 border-slate-400 shadow-sm group">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-slate-50 rounded-xl text-slate-600 group-hover:bg-slate-500 group-hover:text-white transition-all">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>visibility</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {language === 'en' ? 'Low Intent' : 'Bajo Interés'}
                  </span>
                </div>
                <div>
                  <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                    {language === 'en' ? 'Curious' : 'Curiosos'}
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-primary font-headline tracking-tighter">
                      {conversationsData?.bought?.length || 0}
                    </span>
                    <span className="text-slate-400 text-sm font-medium">{language === 'en' ? 'leads' : 'prospectos'}</span>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-50">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-400 rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(100, ((conversationsData?.bought?.length || 0) / (allContacts.length || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </section>

            {/* Middle Section: Analysis & Rules */}
            <section className="grid grid-cols-12 gap-8">
              {/* Segment Analysis */}
              <div className="col-span-12 lg:col-span-5 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-primary-container/10 transition-colors"></div>
                <div className="relative z-10 h-full flex flex-col">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-bold font-headline text-primary">
                      {language === 'en' ? 'Audience Distribution' : 'Distribución de Audiencia'}
                    </h3>
                    <button className="text-primary-container font-bold text-[10px] uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                      {language === 'en' ? 'FULL REPORT' : 'REPORTE COMPLETO'} 
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col justify-center space-y-8">
                    <div className="space-y-4">
                      <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                        <span>{language === 'en' ? 'Classification Mix' : 'Mix de Clasificación'}</span>
                        <span>Total: {(allContacts.length / 1000).toFixed(1)}k</span>
                      </div>
                      <div className="h-16 w-full flex rounded-2xl overflow-hidden shadow-inner border border-slate-50">
                        <div className="h-full bg-emerald-500 border-r border-white/20" style={{ width: `${((conversationsData?.interested?.length || 0) / (allContacts.length || 1)) * 100}%` }} title="Interesados"></div>
                        <div className="h-full bg-amber-500 border-r border-white/20" style={{ width: `${((conversationsData?.chatting?.length || 0) / (allContacts.length || 1)) * 100}%` }} title="Indecisos"></div>
                        <div className="h-full bg-slate-300" style={{ width: `${((conversationsData?.bought?.length || 0) / (allContacts.length || 1)) * 100}%` }} title="Curiosos"></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                          <span className="text-sm font-semibold text-slate-700">{language === 'en' ? 'High Intent (Interested)' : 'Alto Interés (Interesados)'}</span>
                        </div>
                        <span className="font-bold text-primary">{Math.round(((conversationsData?.interested?.length || 0) / (allContacts.length || 1)) * 100)}%</span>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                          <span className="text-sm font-semibold text-slate-700">{language === 'en' ? 'Medium Intent (Undecided)' : 'Interés Medio (Indecisos)'}</span>
                        </div>
                        <span className="font-bold text-primary">{Math.round(((conversationsData?.chatting?.length || 0) / (allContacts.length || 1)) * 100)}%</span>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                          <span className="text-sm font-semibold text-slate-700">{language === 'en' ? 'Low Intent (Curious)' : 'Bajo Interés (Curiosos)'}</span>
                        </div>
                        <span className="font-bold text-primary">{Math.round(((conversationsData?.bought?.length || 0) / (allContacts.length || 1)) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Classification Rules */}
              <div className="col-span-12 lg:col-span-7 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-xl font-bold font-headline text-primary">
                      {language === 'en' ? 'AI Intelligence Rules' : 'Reglas de Inteligencia IA'}
                    </h3>
                    <p className="text-slate-500 text-sm font-medium">
                      {language === 'en' ? 'Configure how Sovereign tags your audience' : 'Configura cómo Sovereign etiqueta a tu audiencia'}
                    </p>
                  </div>
                  <button className="bg-slate-100 p-2.5 rounded-xl text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                    <span className="material-symbols-outlined">settings_suggest</span>
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-primary-container/30 transition-all flex items-start gap-4 group">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-primary-container shrink-0 shadow-sm group-hover:bg-primary-container group-hover:text-white transition-all">
                      <span className="material-symbols-outlined">key</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-primary">{language === 'en' ? 'Keywords for Interested' : 'Palabras Clave para Interesados'}</h4>
                        <div className="flex gap-2">
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg uppercase tracking-wider">{language === 'en' ? 'Active' : 'Activo'}</span>
                          <button className="text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-sm">edit</span></button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 mb-3">Triggered by: "comprar", "precio", "disponible", "quiero uno"</p>
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-[10px] px-2.5 py-1.5 bg-white border border-slate-100 rounded-full text-slate-600 font-bold uppercase tracking-tighter">E-commerce</span>
                        <span className="text-[10px] px-2.5 py-1.5 bg-white border border-slate-100 rounded-full text-slate-600 font-bold uppercase tracking-tighter">Direct Sales</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-primary-container/30 transition-all flex items-start gap-4 group">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-primary-container shrink-0 shadow-sm group-hover:bg-primary-container group-hover:text-white transition-all">
                      <span className="material-symbols-outlined">network_check</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-primary">{language === 'en' ? 'Confidence Threshold' : 'Umbral de Confianza'}</h4>
                        <div className="flex gap-2">
                          <span className="px-2.5 py-1 bg-primary-container/10 text-primary-container text-[10px] font-bold rounded-lg uppercase tracking-wider">Strict</span>
                          <button className="text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-sm">edit</span></button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 mb-3">Auto-tagging required confidence: <span className="font-bold text-primary">85%</span></p>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-container rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>
                  </div>
                  <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-primary-container hover:text-primary-container transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    {language === 'en' ? 'CREATE NEW CLASSIFICATION LOGIC' : 'CREAR NUEVA LÃ“GICA DE CLASIFICACIÃ“N'}
                  </button>
                </div>
              </div>
            </section>

            {/* Bottom Section: Segment Table */}
            <section className="space-y-6">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-bold font-headline text-primary">
                    {language === 'en' ? 'Detailed View: Interesados' : 'Vista Detallada: Interesados'}
                  </h3>
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                    <button className="px-5 py-1.5 text-[10px] font-bold bg-white text-primary shadow-sm rounded-lg uppercase tracking-widest">Live</button>
                    <button className="px-5 py-1.5 text-[10px] font-bold text-slate-400 hover:text-primary transition-colors rounded-lg uppercase tracking-widest">Archive</button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                    <span className="material-symbols-outlined text-sm">download</span>
                    {language === 'en' ? 'Export CSV' : 'Exportar CSV'}
                  </button>
                </div>
              </div>
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Activity</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Confidence</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(conversationsData?.interested || []).slice(0, 10).map((contact: any, i: number) => (
                        <tr key={contact.id || i} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-xs shadow-sm">
                                {contact.customer_name?.substring(0, 2).toUpperCase() || 'CX'}
                              </div>
                              <div>
                                <p className="font-bold text-primary text-sm">{contact.customer_name || 'Desconocido'}</p>
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Interested Lead</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-xs text-slate-500 font-bold">{formatRelativeTime(contact.updated_at || contact.created_at, language)}</span>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-xs text-slate-700 font-mono">{contact.phone_number}</p>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full min-w-[100px] overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '94%' }}></div>
                              </div>
                              <span className="text-[10px] font-black text-emerald-600">94%</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button 
                              onClick={() => {
                                setSelectedChat(contact);
                                setShowChartModal(true);
                              }}
                              className="p-2.5 text-slate-400 hover:text-primary-container hover:bg-primary-container/10 rounded-xl transition-all shadow-sm bg-white border border-slate-100"
                            >
                              <span className="material-symbols-outlined text-lg">forum</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!conversationsData?.interested || conversationsData.interested.length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-8 py-20 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-3">
                              <span className="material-symbols-outlined text-5xl opacity-20">group_off</span>
                              <p className="text-xs font-bold uppercase tracking-widest">
                                {language === 'en' ? 'No high intent contacts found' : 'No se encontraron contactos de alto interés'}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="p-6 bg-slate-50/50 flex justify-between items-center border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {language === 'en' ? `Showing ${Math.min(10, conversationsData?.interested?.length || 0)} of ${conversationsData?.interested?.length || 0} contacts` : `Mostrando ${Math.min(10, conversationsData?.interested?.length || 0)} de ${conversationsData?.interested?.length || 0} contactos`}
                  </span>
                  <div className="flex gap-2">
                    <button className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-sm"><span className="material-symbols-outlined text-sm">chevron_left</span></button>
                    <button className="px-4 py-2 bg-primary-container text-white text-[10px] font-black rounded-xl shadow-lg shadow-primary-container/20">1</button>
                    <button className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-sm"><span className="material-symbols-outlined text-sm">chevron_right</span></button>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {/* ========== BILLING / PAGOS TAB ========== */}
        {activeTab === 'billing' && (
          <motion.div key="billing" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-primary">{language === 'en' ? 'Plans & Billing' : 'Planes y Pagos'}</h2>
                <p className="text-xs text-slate-400 mt-1">{language === 'en' ? 'Choose the plan that best fits your business' : 'Elige el plan que mejor se adapte a tu negocio'}</p>
              </div>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                <span className={`w-2.5 h-2.5 rounded-full ${currentPlan === 'trial' ? 'bg-slate-400' : 'bg-emerald-500'} animate-pulse`}></span>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">{language === 'en' ? 'Current Plan' : 'Plan Actual'}</p>
                  <p className="text-xs font-extrabold text-primary">{currentPlan === 'trial' ? (language === 'en' ? 'Free Trial' : 'Prueba Gratuita') : `Chatea Pro ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}`}</p>
                </div>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {/* Trial */}
              <div className={`relative bg-white rounded-2xl border-2 ${currentPlan === 'trial' ? 'border-primary-container shadow-lg shadow-primary-container/10' : 'border-slate-200'} p-6 flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5`}>
                {currentPlan === 'trial' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-container text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full">{language === 'en' ? 'Current' : 'Actual'}</div>}
                <div className="flex items-center gap-2 mb-4"><span className="material-symbols-outlined text-slate-400">star_outline</span><h3 className="text-sm font-extrabold text-primary">{language === 'en' ? 'Free Trial (14 days)' : 'Prueba Gratuita (14 d\u00EDas)'}</h3></div>
                <div className="mb-5"><span className="text-4xl font-black text-primary">$0</span><span className="text-xs text-slate-400 ml-1">USD/mes</span></div>
                <div className="space-y-2.5 mb-6 flex-1">
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span><span className="text-xs text-slate-600">1 Bot Inteligente</span></div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span><span className="text-xs text-slate-600">200 {language === 'en' ? 'Contacts' : 'Contactos'}</span></div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span><span className="text-xs text-slate-600">1 {language === 'en' ? 'Member' : 'Miembro'}</span></div>
                </div>
                <button disabled className="w-full py-3 bg-slate-100 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed">{language === 'en' ? 'Free Plan' : 'Plan Gratuito'}</button>
              </div>

              {/* Start */}
              <div className={`relative bg-white rounded-2xl border-2 ${currentPlan === 'start' ? 'border-primary-container shadow-lg shadow-primary-container/10' : 'border-slate-200'} p-6 flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5`}>
                {currentPlan === 'start' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-container text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full">{language === 'en' ? 'Current' : 'Actual'}</div>}
                <div className="flex items-center gap-2 mb-4"><span className="material-symbols-outlined text-sky-500">star_half</span><h3 className="text-sm font-extrabold text-primary">Chatea Pro Start</h3></div>
                <p className="text-[10px] text-slate-400 -mt-3 mb-3">{language === 'en' ? 'Starting from' : 'Empezando desde'}</p>
                <div className="mb-5"><span className="text-4xl font-black text-primary">$49</span><span className="text-xs text-slate-400 ml-1">USD/mes</span></div>
                <div className="space-y-2.5 mb-6 flex-1">
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span><span className="text-xs text-slate-600">1 Bot Inteligente</span></div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span><span className="text-xs text-slate-600">1,000 {language === 'en' ? 'Contacts' : 'Contactos'}</span></div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span><span className="text-xs text-slate-600">5 {language === 'en' ? 'Members' : 'Miembros'}</span></div>
                </div>
                <button onClick={() => setShowPlanConfirm('start')} className={`w-full py-3 text-xs font-bold rounded-xl transition-all active:scale-[0.98] ${currentPlan === 'start' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20 hover:opacity-90'}`}>{currentPlan === 'start' ? (language === 'en' ? '\u2713 Active Plan' : '\u2713 Plan Activo') : (language === 'en' ? 'Choose Plan' : 'Cambiar plan')}</button>
              </div>

              {/* Advanced - Popular */}
              <div className={`relative bg-white rounded-2xl border-2 ${currentPlan === 'advanced' ? 'border-primary-container shadow-lg shadow-primary-container/10' : 'border-sky-400'} p-6 flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5 ring-2 ring-sky-400/20`}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-sky-500 to-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full">{currentPlan === 'advanced' ? (language === 'en' ? '\u2713 Current' : '\u2713 Actual') : (language === 'en' ? '\u2B50 Popular' : '\u2B50 Popular')}</div>
                <div className="flex items-center gap-2 mb-4"><span className="material-symbols-outlined text-blue-600">star</span><h3 className="text-sm font-extrabold text-primary">Chatea Pro Advanced</h3></div>
                <p className="text-[10px] text-slate-400 -mt-3 mb-3">{language === 'en' ? 'Starting from' : 'Empezando desde'}</p>
                <div className="mb-5"><span className="text-4xl font-black text-primary">$109</span><span className="text-xs text-slate-400 ml-1">USD/mes</span></div>
                <div className="space-y-2.5 mb-6 flex-1">
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span><span className="text-xs text-slate-600">1 Bot Inteligente</span></div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span><span className="text-xs text-slate-600">10,000 {language === 'en' ? 'Contacts' : 'Contactos'}</span></div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span><span className="text-xs text-slate-600">5 {language === 'en' ? 'Members' : 'Miembros'}</span></div>
                </div>
                <button onClick={() => setShowPlanConfirm('advanced')} className={`w-full py-3 text-xs font-bold rounded-xl transition-all active:scale-[0.98] ${currentPlan === 'advanced' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20 hover:opacity-90'}`}>{currentPlan === 'advanced' ? (language === 'en' ? '\u2713 Active Plan' : '\u2713 Plan Activo') : (language === 'en' ? 'Choose Plan' : 'Cambiar plan')}</button>
              </div>

              {/* Plus */}
              <div className={`relative bg-white rounded-2xl border-2 ${currentPlan === 'plus' ? 'border-primary-container shadow-lg shadow-primary-container/10' : 'border-slate-200'} p-6 flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5`}>
                {currentPlan === 'plus' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-container text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full">{language === 'en' ? 'Current' : 'Actual'}</div>}
                <div className="flex items-center gap-2 mb-4"><span className="material-symbols-outlined text-amber-500">workspace_premium</span><h3 className="text-sm font-extrabold text-primary">Chatea Pro Plus</h3></div>
                <p className="text-[10px] text-slate-400 -mt-3 mb-3">{language === 'en' ? 'Starting from' : 'Empezando desde'}</p>
                <div className="mb-5"><span className="text-4xl font-black text-primary">$189</span><span className="text-xs text-slate-400 ml-1">USD/mes</span></div>
                <div className="space-y-2.5 mb-6 flex-1">
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span><span className="text-xs text-slate-600">1 Bot Inteligente</span></div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span><span className="text-xs text-slate-600">20,000 {language === 'en' ? 'Contacts' : 'Contactos'}</span></div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span><span className="text-xs text-slate-600">5 {language === 'en' ? 'Members' : 'Miembros'}</span></div>
                </div>
                <button onClick={() => setShowPlanConfirm('plus')} className={`w-full py-3 text-xs font-bold rounded-xl transition-all active:scale-[0.98] ${currentPlan === 'plus' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20 hover:opacity-90'}`}>{currentPlan === 'plus' ? (language === 'en' ? '\u2713 Active Plan' : '\u2713 Plan Activo') : (language === 'en' ? 'Choose Plan' : 'Cambiar plan')}</button>
              </div>

              {/* Master */}
              <div className={`relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border-2 ${currentPlan === 'master' ? 'border-amber-400 shadow-lg shadow-amber-400/10' : 'border-slate-700'} p-6 flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5`}>
                {currentPlan === 'master' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full">{language === 'en' ? 'Current' : 'Actual'}</div>}
                <div className="flex items-center gap-2 mb-4"><span className="material-symbols-outlined text-amber-400">diamond</span><h3 className="text-sm font-extrabold text-white">Chatea Pro Master</h3></div>
                <p className="text-[10px] text-slate-400 -mt-3 mb-3">{language === 'en' ? 'Starting from' : 'Empezando desde'}</p>
                <div className="mb-5"><span className="text-4xl font-black text-white">$399</span><span className="text-xs text-slate-400 ml-1">USD/mes</span></div>
                <div className="space-y-2.5 mb-6 flex-1">
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-amber-400 text-sm">check_circle</span><span className="text-xs text-slate-300">5 Bots Inteligentes</span></div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-amber-400 text-sm">check_circle</span><span className="text-xs text-slate-300">50,000 {language === 'en' ? 'Contacts' : 'Contactos'}</span></div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-amber-400 text-sm">check_circle</span><span className="text-xs text-slate-300">10 {language === 'en' ? 'Members' : 'Miembros'}</span></div>
                </div>
                <button onClick={() => setShowPlanConfirm('master')} className={`w-full py-3 text-xs font-bold rounded-xl transition-all active:scale-[0.98] ${currentPlan === 'master' ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' : 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 shadow-lg shadow-amber-400/20 hover:opacity-90'}`}>{currentPlan === 'master' ? (language === 'en' ? '\u2713 Active Plan' : '\u2713 Plan Activo') : (language === 'en' ? 'Choose Plan' : 'Cambiar plan')}</button>
              </div>
            </div>

            {/* Plan Comparison Table */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-extrabold text-primary mb-4">{language === 'en' ? 'Plan Comparison' : 'Comparaci\u00F3n de Planes'}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-2 text-slate-400 font-bold uppercase tracking-wider">{language === 'en' ? 'Feature' : 'Caracter\u00EDstica'}</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-bold">Trial</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-bold">Start</th>
                    <th className="text-center py-3 px-2 text-sky-500 font-bold">Advanced</th>
                    <th className="text-center py-3 px-2 text-slate-400 font-bold">Plus</th>
                    <th className="text-center py-3 px-2 text-amber-500 font-bold">Master</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    <tr><td className="py-3 px-2 font-semibold text-slate-600">{language === 'en' ? 'Price' : 'Precio'}</td><td className="text-center font-bold text-slate-800">$0</td><td className="text-center font-bold text-slate-800">$49</td><td className="text-center font-bold text-sky-600">$109</td><td className="text-center font-bold text-slate-800">$189</td><td className="text-center font-bold text-amber-600">$399</td></tr>
                    <tr><td className="py-3 px-2 font-semibold text-slate-600">Bots</td><td className="text-center">1</td><td className="text-center">1</td><td className="text-center text-sky-600">1</td><td className="text-center">1</td><td className="text-center text-amber-600 font-bold">5</td></tr>
                    <tr><td className="py-3 px-2 font-semibold text-slate-600">{language === 'en' ? 'Contacts' : 'Contactos'}</td><td className="text-center">200</td><td className="text-center">1K</td><td className="text-center text-sky-600">10K</td><td className="text-center">20K</td><td className="text-center text-amber-600 font-bold">50K</td></tr>
                    <tr><td className="py-3 px-2 font-semibold text-slate-600">{language === 'en' ? 'Members' : 'Miembros'}</td><td className="text-center">1</td><td className="text-center">5</td><td className="text-center text-sky-600">5</td><td className="text-center">5</td><td className="text-center text-amber-600 font-bold">10</td></tr>
                    <tr><td className="py-3 px-2 font-semibold text-slate-600">{language === 'en' ? 'Duration' : 'Duraci\u00F3n'}</td><td className="text-center">14 {language === 'en' ? 'days' : 'd\u00EDas'}</td><td className="text-center">{language === 'en' ? 'Monthly' : 'Mensual'}</td><td className="text-center text-sky-600">{language === 'en' ? 'Monthly' : 'Mensual'}</td><td className="text-center">{language === 'en' ? 'Monthly' : 'Mensual'}</td><td className="text-center text-amber-600">{language === 'en' ? 'Monthly' : 'Mensual'}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment History */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-extrabold text-primary mb-4">{language === 'en' ? 'Payment History' : 'Historial de Pagos'}</h3>
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <span className="material-symbols-outlined text-3xl mb-2">receipt_long</span>
                <p className="text-xs font-medium">{language === 'en' ? 'No payments yet' : 'A\u00FAn no hay pagos registrados'}</p>
                <p className="text-[10px] mt-1">{language === 'en' ? 'Payments will appear here once you subscribe to a plan' : 'Los pagos aparecer\u00E1n aqu\u00ED cuando te suscribas a un plan'}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Plan Confirmation Modal */}
        {showPlanConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center px-4" onClick={() => setShowPlanConfirm(null)}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center"><span className="material-symbols-outlined text-white text-2xl">payments</span></div>
                <h3 className="text-lg font-extrabold text-primary">{language === 'en' ? 'Confirm Plan Change' : 'Confirmar Cambio de Plan'}</h3>
                <p className="text-xs text-slate-400 mt-2">
                  {language === 'en' 
                    ? `You are about to switch to Chatea Pro ${showPlanConfirm.charAt(0).toUpperCase() + showPlanConfirm.slice(1)}` 
                    : `Est\u00E1s a punto de cambiar a Chatea Pro ${showPlanConfirm.charAt(0).toUpperCase() + showPlanConfirm.slice(1)}`}
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">{language === 'en' ? 'Monthly charge' : 'Cobro mensual'}</span>
                  <span className="text-lg font-black text-primary">${showPlanConfirm === 'start' ? '49' : showPlanConfirm === 'advanced' ? '109' : showPlanConfirm === 'plus' ? '189' : '399'} USD</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowPlanConfirm(null)} className="flex-1 py-3 border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all">{language === 'en' ? 'Cancel' : 'Cancelar'}</button>
                <button onClick={() => { setCurrentPlan(showPlanConfirm as any); setShowPlanConfirm(null); }} className="flex-1 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">credit_card</span>
                  {language === 'en' ? 'Pay with PayPhone' : 'Pagar con PayPhone'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-10"
          >
            {/* Header Section */}
            <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h2 className="text-5xl font-extrabold tracking-tight text-primary font-headline mb-2">
                  {language === 'en' ? 'Performance Analytics' : 'Análisis de Rendimiento'}
                </h2>
                <p className="text-lg text-slate-500 font-medium max-w-2xl">
                  {language === 'en' 
                    ? 'Real-time intelligence orchestration for your enterprise.' 
                    : 'Orquestación de inteligencia en tiempo real para tu empresa.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 bg-white border border-slate-100 px-5 py-3 rounded-2xl shadow-sm">
                  <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    {new Date().toLocaleDateString(language, { month: 'short', day: 'numeric' })} - {new Date().toLocaleDateString(language, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="material-symbols-outlined text-sm text-slate-300">expand_more</span>
                </div>
                <button className="bg-primary-container text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary-container/20 hover:opacity-90 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-sm">download</span>
                  {language === 'en' ? 'Export Report' : 'Exportar Reporte'}
                </button>
              </div>
            </section>

            {/* Key Metrics Row */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Conversations */}
              <div className="bg-white p-8 rounded-3xl border border-slate-50 shadow-sm flex flex-col justify-between hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <span className="p-3 bg-primary-container/5 text-primary-container rounded-xl group-hover:bg-primary-container group-hover:text-white transition-all">
                    <span className="material-symbols-outlined">forum</span>
                  </span>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                    12.4%
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{language === 'en' ? 'Total Conversations' : 'Conversaciones Totales'}</p>
                  <h3 className="text-4xl font-black text-primary tracking-tighter">
                    {allContacts.length.toLocaleString()}
                  </h3>
                </div>
                <div className="mt-6 h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                  <div className="bg-primary-container h-full w-[75%] rounded-full"></div>
                </div>
              </div>

              {/* Avg. AI Confidence */}
              <div className="bg-white p-8 rounded-3xl border border-slate-50 shadow-sm flex flex-col items-center justify-center text-center hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">{language === 'en' ? 'Avg. AI Confidence' : 'Confianza Media IA'}</p>
                <div className="relative flex items-center justify-center">
                  <svg className="w-28 h-28 transform -rotate-90">
                    <circle className="text-slate-50" cx="56" cy="56" fill="transparent" r="48" stroke="currentColor" strokeWidth="10"></circle>
                    <circle className="text-primary-container" cx="56" cy="56" fill="transparent" r="48" stroke="currentColor" strokeDasharray="301.6" strokeDashoffset="24.1" strokeWidth="10" strokeLinecap="round"></circle>
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-black text-primary">92%</span>
                  </div>
                </div>
              </div>

              {/* Message Volume */}
              <div className="bg-white p-8 rounded-3xl border border-slate-50 shadow-sm flex flex-col justify-between hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{language === 'en' ? 'Weekly Volume' : 'Volumen Semanal'}</p>
                  <h3 className="text-3xl font-black text-primary tracking-tighter">
                    {(allContacts.length * 15).toLocaleString()}
                  </h3>
                </div>
                <div className="mt-6 flex items-end gap-1.5 h-16">
                  {[40, 60, 90, 55, 70, 45, 85].map((h, i) => (
                    <div 
                      key={i} 
                      className={`w-full rounded-md transition-all duration-500 ${h > 80 ? 'bg-primary-container shadow-lg shadow-primary-container/20' : 'bg-slate-100 hover:bg-slate-200'}`} 
                      style={{ height: `${h}%` }}
                    ></div>
                  ))}
                </div>
              </div>

              {/* Conversion Rate */}
              <div className="bg-white p-8 rounded-3xl border border-slate-50 shadow-sm flex flex-col justify-between hover:shadow-xl hover:shadow-slate-200/50 transition-all">
                <div className="flex justify-between items-start">
                  <span className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <span className="material-symbols-outlined">ads_click</span>
                  </span>
                </div>
                <div className="mt-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{language === 'en' ? 'Conversion Rate' : 'Tasa de Conversión'}</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-black text-primary tracking-tighter">18.2%</h3>
                    <span className="text-[10px] text-emerald-600 font-black">+2.1%</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Main Analytics Row */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Classification Distribution */}
              <div className="lg:col-span-4 bg-white p-10 rounded-3xl border border-slate-50 shadow-sm">
                <div className="mb-10">
                  <h4 className="text-xl font-black text-primary mb-2">{language === 'en' ? 'Classification Mix' : 'Mix de Clasificación'}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{language === 'en' ? 'Psychographic segmentation' : 'Segmentación psicográfica'}</p>
                </div>
                <div className="relative h-64 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-52 h-52 rounded-full border-[20px] border-emerald-500 shadow-lg shadow-emerald-500/10"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-52 h-52 rounded-full border-[20px] border-amber-500 border-l-transparent border-b-transparent transform rotate-45"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-52 h-52 rounded-full border-[20px] border-slate-200 border-r-transparent border-t-transparent transform rotate-[160deg]"></div>
                  </div>
                  <div className="z-10 text-center">
                    <p className="text-4xl font-black text-primary tracking-tighter">100%</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Inbound</p>
                  </div>
                </div>
                <div className="mt-10 space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{language === 'en' ? 'Interested' : 'Interesados'}</span>
                    </div>
                    <span className="text-sm font-black text-primary">{Math.round(((conversationsData?.interested?.length || 0) / (allContacts.length || 1)) * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{language === 'en' ? 'Undecided' : 'Indecisos'}</span>
                    </div>
                    <span className="text-sm font-black text-primary">{Math.round(((conversationsData?.chatting?.length || 0) / (allContacts.length || 1)) * 100)}%</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-slate-300"></span>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{language === 'en' ? 'Curious' : 'Curiosos'}</span>
                    </div>
                    <span className="text-sm font-black text-primary">{Math.round(((conversationsData?.bought?.length || 0) / (allContacts.length || 1)) * 100)}%</span>
                  </div>
                </div>
              </div>

              {/* Interaction Over Time */}
              <div className="lg:col-span-8 bg-white p-10 rounded-3xl border border-slate-50 shadow-sm">
                <div className="flex justify-between items-start mb-12">
                  <div>
                    <h4 className="text-xl font-black text-primary mb-2">{language === 'en' ? 'Interaction Trends' : 'Tendencias de Interacción'}</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{language === 'en' ? 'Daily message activity' : 'Actividad diaria de mensajes'}</p>
                  </div>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                    <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-white text-primary shadow-sm rounded-lg">30 Days</button>
                    <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-all rounded-lg">90 Days</button>
                  </div>
                </div>
                <div className="relative h-[300px] w-full">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 200">
                    <defs>
                      <linearGradient id="lineGradient" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#00003c" />
                        <stop offset="100%" stopColor="#000080" />
                      </linearGradient>
                      <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#000080" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#000080" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Grid Lines */}
                    {[50, 100, 150].map((y, i) => (
                      <line key={i} stroke="#e2e8f0" strokeDasharray="4 4" x1="0" x2="800" y1={y} y2={y}></line>
                    ))}
                    {/* Area Path */}
                    <path d="M0,180 L50,160 L100,175 L150,120 L200,130 L250,90 L300,105 L350,60 L400,75 L450,40 L500,65 L550,55 L600,80 L650,45 L700,50 L750,20 L800,30 V200 H0 Z" fill="url(#areaGradient)"></path>
                    {/* Line Path */}
                    <motion.path 
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                      d="M0,180 L50,160 L100,175 L150,120 L200,130 L250,90 L300,105 L350,60 L400,75 L450,40 L500,65 L550,55 L600,80 L650,45 L700,50 L750,20 L800,30" 
                      fill="none" 
                      stroke="url(#lineGradient)" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="5"
                    ></motion.path>
                  </svg>
                  <div className="flex justify-between mt-8 border-t border-slate-50 pt-4">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{new Date(Date.now() - 30*24*60*60*1000).toLocaleDateString(language, { month: 'short', day: 'numeric' })}</span>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{new Date(Date.now() - 15*24*60*60*1000).toLocaleDateString(language, { month: 'short', day: 'numeric' })}</span>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{language === 'en' ? 'Today' : 'Hoy'}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Bottom Table Section */}
            <section className="bg-white rounded-3xl border border-slate-50 shadow-sm overflow-hidden">
              <div className="px-10 py-8 flex justify-between items-center border-b border-slate-50">
                <h4 className="text-xl font-black text-primary">{language === 'en' ? 'Top Performance Segments' : 'Segmentos de Mayor Rendimiento'}</h4>
                <button 
                  onClick={() => setActiveTab('segments')}
                  className="text-[10px] font-black text-primary-container uppercase tracking-widest flex items-center gap-2 hover:underline"
                >
                  {language === 'en' ? 'View All Segments' : 'Ver Todos los Segmentos'}
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language === 'en' ? 'Segment Name' : 'Nombre del Segmento'}</th>
                      <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{language === 'en' ? 'Active Members' : 'Miembros Activos'}</th>
                      <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{language === 'en' ? 'Engagement' : 'Engagement'}</th>
                      <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{language === 'en' ? 'AI Precision' : 'Precisión IA'}</th>
                      <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">{language === 'en' ? 'Status' : 'Estado'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <tr className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-sm">
                            <span className="material-symbols-outlined text-lg">star</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primary">{language === 'en' ? 'High Intent Leads' : 'Leads de Alto Interés'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">B2C Primary</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className="text-sm font-black text-primary">{conversationsData?.interested?.length || 0}</span>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-[10px] font-black text-primary">84.2%</span>
                          <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-container w-[84%] rounded-full shadow-lg shadow-primary-container/20"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg uppercase tracking-wider">98.1%</span>
                      </td>
                      <td className="px-10 py-6 text-right text-emerald-500">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shadow-sm">
                            <span className="material-symbols-outlined text-lg">pending</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primary">{language === 'en' ? 'Undecided Nurturing' : 'Nutrición de Indecisos'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Retargeting</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className="text-sm font-black text-primary">{conversationsData?.chatting?.length || 0}</span>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-[10px] font-black text-primary">42.5%</span>
                          <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 w-[42%] rounded-full shadow-lg shadow-amber-500/20"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black rounded-lg uppercase tracking-wider">92.4%</span>
                      </td>
                      <td className="px-10 py-6 text-right text-slate-300">
                        <span className="material-symbols-outlined">trending_flat</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </motion.div>
        )}


      {/* ========== GLOBAL BULK MESSAGING MODAL ========== */}
      {showBulkPanel && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9998] flex items-start justify-center pt-24 px-4" onClick={() => setShowBulkPanel(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-4xl max-h-[75vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-primary to-primary-container rounded-lg">
                  <span className="material-symbols-outlined text-white text-lg">campaign</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-primary">{language === 'es' ? 'Centro de Mensajes Masivos' : 'Bulk Message Center'}</h3>
                  <p className="text-[10px] text-slate-400">{language === 'es' ? 'Selecciona contactos, redacta y env\u00EDa mensajes personalizados' : 'Select contacts, compose and send personalized messages'}</p>
                </div>
              </div>
              <button onClick={() => setShowBulkPanel(false)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Three Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* === COLUMN 1: Contact Selection === */}
              <div className="bg-crm-surface-container-lowest rounded-xl border border-slate-100 p-4 flex flex-col max-h-[420px]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">{language === 'es' ? 'Contactos' : 'Contacts'}</h4>
                  <span className="text-[10px] font-bold text-primary-container bg-primary-container/10 px-2 py-0.5 rounded-full">
                    {selectedContacts.size} {language === 'es' ? 'seleccionados' : 'selected'}
                  </span>
                </div>
                <div className="relative mb-3">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                  <input type="text" value={bulkSearch} onChange={e => setBulkSearch(e.target.value)} placeholder={language === 'es' ? 'Buscar contacto...' : 'Search contact...'} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container/20 transition-all" />
                </div>
                <label className="flex items-center gap-2 px-3 py-2 bg-primary-container/5 rounded-lg mb-2 cursor-pointer hover:bg-primary-container/10 transition-colors">
                  <input type="checkbox" checked={selectAllContacts} onChange={e => handleSelectAll(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-primary-container focus:ring-primary-container/30" />
                  <span className="text-xs font-bold text-primary">{language === 'es' ? 'Seleccionar Todos' : 'Select All'}</span>
                  <span className="ml-auto text-[10px] text-slate-400">({filteredBulkContacts.length})</span>
                </label>
                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                  {filteredBulkContacts.map((c: any) => (
                    <label key={c.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors group">
                      <input type="checkbox" checked={selectedContacts.has(c.id)} onChange={() => handleToggleContact(c.id)} className="w-3.5 h-3.5 rounded border-slate-300 text-primary-container focus:ring-primary-container/30" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{c.customer_name || 'Sin nombre'}</p>
                        <p className="text-[10px] text-slate-400 truncate">{c.phone_number}</p>
                      </div>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.status === 'chatting' ? 'bg-emerald-500' : c.status === 'interested' ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                    </label>
                  ))}
                  {filteredBulkContacts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                      <span className="material-symbols-outlined text-2xl mb-1">person_off</span>
                      <p className="text-xs">{language === 'es' ? 'No hay contactos' : 'No contacts'}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* === COLUMN 2: Message Composer === */}
              <div className="bg-crm-surface-container-lowest rounded-xl border border-slate-100 p-4 flex flex-col max-h-[420px]">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">{language === 'es' ? 'Redactar Mensaje' : 'Compose Message'}</h4>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-[10px] text-slate-400 font-medium self-center mr-1">{language === 'es' ? 'Variables:' : 'Variables:'}</span>
                  {['{Nombre}', '{Apellido}', '{Empresa}'].map(v => (
                    <button key={v} onClick={() => handleInsertVariable(v)} className="px-2.5 py-1 bg-primary-container/10 text-primary-container text-[10px] font-bold rounded-md hover:bg-primary-container/20 transition-colors border border-primary-container/20">{v}</button>
                  ))}
                </div>
                <textarea ref={bulkMessageRef} value={bulkMessage} onChange={e => setBulkMessage(e.target.value)} placeholder={language === 'es' ? '\u00A1Hola {Nombre}! Escribe tu mensaje masivo aqu\u00ED...' : 'Hello {Nombre}! Write your bulk message here...'} className="flex-1 w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all resize-none leading-relaxed" />
                <div className="mt-3 flex gap-2">
                  <input type="text" value={templateTitle} onChange={e => setTemplateTitle(e.target.value)} placeholder={language === 'es' ? 'Nombre de plantilla...' : 'Template name...'} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-container transition-all" />
                  <button onClick={handleSaveTemplate} disabled={!bulkMessage.trim()} className="px-3 py-2 bg-primary-container/10 text-primary-container text-[10px] font-bold rounded-lg hover:bg-primary-container/20 transition-colors disabled:opacity-40 flex items-center gap-1 border border-primary-container/20">
                    <span className="material-symbols-outlined text-xs">bookmark_add</span>
                    {language === 'es' ? 'Guardar' : 'Save'}
                  </button>
                </div>
              </div>

              {/* === COLUMN 3: Template Library === */}
              <div className="bg-crm-surface-container-lowest rounded-xl border border-slate-100 p-4 flex flex-col max-h-[420px]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">{language === 'es' ? 'Plantillas Guardadas' : 'Saved Templates'}</h4>
                  <button onClick={() => setShowAddTemplate(!showAddTemplate)} className={`p-1 rounded-md transition-all ${showAddTemplate ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-primary-container/10 text-primary-container hover:bg-primary-container/20'}`} title={language === 'es' ? 'Agregar plantilla' : 'Add template'}>
                    <span className="material-symbols-outlined text-sm">{showAddTemplate ? 'close' : 'add'}</span>
                  </button>
                </div>
                {showAddTemplate && (
                  <div className="bg-primary-container/5 border border-primary-container/20 rounded-lg p-3 mb-2 space-y-2">
                    <input type="text" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder={language === 'es' ? 'Nombre de la plantilla...' : 'Template name...'} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-container transition-all" />
                    <textarea value={newTemplateContent} onChange={e => setNewTemplateContent(e.target.value)} placeholder={language === 'es' ? 'Escribe el contenido de la plantilla...' : 'Write the template content...'} rows={3} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-container transition-all resize-none" />
                    <button onClick={() => { if (!newTemplateContent.trim()) return; const title = newTemplateName.trim() || `Plantilla ${savedTemplates.length + 1}`; setSavedTemplates(prev => [...prev, { id: Date.now().toString(), title, content: newTemplateContent }]); setNewTemplateName(''); setNewTemplateContent(''); setShowAddTemplate(false); }} disabled={!newTemplateContent.trim()} className="w-full px-3 py-2 bg-primary-container text-white text-[10px] font-bold rounded-md hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-xs">add_circle</span>
                      {language === 'es' ? 'Agregar Plantilla' : 'Add Template'}
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {savedTemplates.map(t => (
                    <div key={t.id} className="bg-white border border-slate-100 rounded-lg p-3 group hover:border-primary-container/30 hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between mb-1.5"><h5 className="text-xs font-bold text-primary truncate flex-1">{t.title}</h5></div>
                      <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2 mb-2.5">{t.content}</p>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleUseTemplate(t.content)} className="flex-1 px-2.5 py-1.5 bg-primary-container text-white text-[10px] font-bold rounded-md hover:opacity-90 transition-all flex items-center justify-center gap-1"><span className="material-symbols-outlined text-xs">edit_note</span>{language === 'es' ? 'Usar' : 'Use'}</button>
                        <button onClick={() => handleDeleteTemplate(t.id)} className="px-2.5 py-1.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-md hover:bg-red-100 transition-all flex items-center justify-center gap-1"><span className="material-symbols-outlined text-xs">delete</span></button>
                      </div>
                    </div>
                  ))}
                  {savedTemplates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                      <span className="material-symbols-outlined text-2xl mb-1">description</span>
                      <p className="text-xs">{language === 'es' ? 'Sin plantillas guardadas' : 'No saved templates'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* === ACTION BAR === */}
            <div className="mt-5 bg-crm-surface-container-lowest rounded-xl border border-slate-100 p-4">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                  <span className="material-symbols-outlined text-slate-400 text-sm">timer</span>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{language === 'es' ? 'Delay entre mensajes' : 'Delay between messages'}</label>
                  <select value={sendDelay} onChange={e => setSendDelay(Number(e.target.value))} className="bg-transparent text-xs font-bold text-primary border-none focus:outline-none cursor-pointer">
                    <option value={1}>1s</option><option value={2}>2s</option><option value={3}>3s</option><option value={5}>5s</option><option value={10}>10s</option><option value={15}>15s</option><option value={30}>30s</option>
                  </select>
                </div>
                <div className="flex-1 text-center">
                  <p className="text-[10px] text-slate-400">
                    {selectedContacts.size > 0 && bulkMessage.trim()
                      ? (language === 'es' ? `Listo para enviar a ${selectedContacts.size} contactos (~${Math.ceil(selectedContacts.size * sendDelay / 60)} min)` : `Ready to send to ${selectedContacts.size} contacts (~${Math.ceil(selectedContacts.size * sendDelay / 60)} min)`)
                      : (language === 'es' ? 'Selecciona contactos y redacta un mensaje' : 'Select contacts and compose a message')}
                  </p>
                </div>
                <button onClick={handleStartBulkSend} disabled={isBulkSending || selectedContacts.size === 0 || !bulkMessage.trim()} className="px-6 py-3 bg-gradient-to-br from-primary to-primary-container text-white font-bold text-xs rounded-lg shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">{isBulkSending ? 'hourglass_top' : 'rocket_launch'}</span>
                  {isBulkSending ? (language === 'es' ? 'Enviando...' : 'Sending...') : (language === 'es' ? 'Iniciar Env\u00EDo Masivo' : 'Start Bulk Send')}
                </button>
              </div>
              {isBulkSending && bulkTotal > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-primary">{language === 'es' ? `Enviando ${bulkProgress} de ${bulkTotal}...` : `Sending ${bulkProgress} of ${bulkTotal}...`}</span>
                    <span className="text-[10px] font-bold text-primary-container">{Math.round((bulkProgress / bulkTotal) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-500 ease-out" style={{ width: `${(bulkProgress / bulkTotal) * 100}%` }} />
                  </div>
                </div>
              )}
              {!isBulkSending && bulkProgress > 0 && bulkProgress === bulkTotal && (
                <div className="mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                  <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                  <p className="text-xs font-bold text-emerald-700">{language === 'es' ? `\u00A1Env\u00EDo completado! ${bulkTotal} mensajes enviados exitosamente.` : `Send complete! ${bulkTotal} messages sent successfully.`}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

</main>
    </div>



{/* ----------------- FULL SCREEN INBOX (Portal to body) ----------------- */}
    {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {(selectedChat && showChartModal) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-crm-surface text-on-surface font-body overflow-y-auto"
          >
            {/* TopAppBar Anchor */}
            <header className="bg-[#f8f9fa] dark:bg-[#00003c] flex justify-between items-center w-full px-8 h-16 sticky top-0 z-50 shadow-[0_24px_24px_rgba(25,28,29,0.04)]">
              <div className="flex items-center gap-4">
                <button onClick={() => { setShowChartModal(false); setChatSearch(''); setChatSearchIdx(-1); }} className="p-2 hover:bg-crm-surface-container-low rounded-full transition-colors flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary-container">arrow_back</span>
                </button>
                <h2 className="font-['Manrope'] font-bold tracking-tight text-xl text-[#000080] dark:text-white">RIFX Sovereign</h2>
              </div>
              <div className="flex items-center gap-6">
                {/* Búsqueda funcional en mensajes */}
                <div className="relative hidden sm:block">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
                  <input 
                    className="bg-crm-surface-container-low border-none rounded-full pl-10 pr-4 py-1.5 text-sm focus:ring-2 focus:ring-primary-container/20 w-64 text-black" 
                    placeholder={language === 'en' ? 'Search in conversation...' : 'Buscar en conversación...'} 
                    type="text"
                    value={chatSearch}
                    onChange={(e) => {
                      setChatSearch(e.target.value);
                      if (e.target.value.trim()) {
                        const idx = chatMessages.findIndex((m: any) => m.content?.toLowerCase().includes(e.target.value.toLowerCase()));
                        setChatSearchIdx(idx);
                        if (idx >= 0) {
                          // Scroll to found message
                          setTimeout(() => {
                            const el = document.getElementById(`chat-msg-${idx}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 100);
                        }
                      } else {
                        setChatSearchIdx(-1);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && chatSearch.trim()) {
                        // Find next match after current
                        const startIdx = chatSearchIdx >= 0 ? chatSearchIdx + 1 : 0;
                        const nextIdx = chatMessages.findIndex((m: any, i: number) => i >= startIdx && m.content?.toLowerCase().includes(chatSearch.toLowerCase()));
                        if (nextIdx >= 0) {
                          setChatSearchIdx(nextIdx);
                          setTimeout(() => {
                            const el = document.getElementById(`chat-msg-${nextIdx}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 100);
                        } else {
                          // Wrap around
                          const wrapIdx = chatMessages.findIndex((m: any) => m.content?.toLowerCase().includes(chatSearch.toLowerCase()));
                          if (wrapIdx >= 0) {
                            setChatSearchIdx(wrapIdx);
                            setTimeout(() => {
                              const el = document.getElementById(`chat-msg-${wrapIdx}`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);
                          }
                        }
                      }
                    }}
                  />
                  {chatSearch && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                      {chatMessages.filter((m: any) => m.content?.toLowerCase().includes(chatSearch.toLowerCase())).length} {language === 'es' ? 'resultados' : 'results'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {/* Notification bell - connected to humanAlerts */}
                  <div className="relative">
                    <span 
                      onClick={() => setShowChatNotifications(!showChatNotifications)} 
                      className={`material-symbols-outlined cursor-pointer p-2 rounded-full transition-colors ${humanAlerts.length > 0 ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-slate-500 hover:bg-[#f3f4f5]'}`}
                      style={humanAlerts.length > 0 ? { animation: 'swing 2s infinite ease-in-out' } : {}}
                    >
                      notifications
                    </span>
                    {humanAlerts.length > 0 && (
                      <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                    )}
                    {showChatNotifications && (
                      <div className="absolute top-full mt-2 right-0 w-72 bg-white shadow-2xl rounded-2xl border border-slate-100 p-4 z-50">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language === 'es' ? 'Solicitudes de Humano' : 'Human Requests'}</p>
                          {humanAlerts.length > 0 && <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{humanAlerts.length}</span>}
                        </div>
                        {humanAlerts.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-3">{language === 'es' ? 'No hay solicitudes pendientes' : 'No pending requests'}</p>
                        ) : (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {humanAlerts.map(alert => (
                              <div 
                                key={alert.id}
                                className="flex justify-between items-center hover:bg-red-50/50 p-2 rounded-xl transition-all cursor-pointer group/item border border-transparent hover:border-red-100"
                                onClick={() => {
                                  setShowChatNotifications(false);
                                  setShowChartModal(false);
                                  setTimeout(() => {
                                    setSelectedChat({ id: alert.id, name: alert.name, status: 'chatting', phone_number: '', created_at: '' });
                                    setShowChartModal(true);
                                  }, 200);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                  <span className="text-xs font-bold text-slate-700 group-hover/item:text-primary truncate max-w-[120px]">{alert.name}</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-[9px] text-slate-400">{alert.time}</p>
                                  <p className="text-[8px] text-primary font-medium opacity-0 group-hover/item:opacity-100 transition-opacity">{language === 'es' ? 'Ir al chat â†’' : 'Go to chat â†’'}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Help tooltip */}
                  <div className="relative group/help">
                    <span className="material-symbols-outlined text-slate-500 cursor-pointer hover:bg-[#f3f4f5] p-2 rounded-full transition-colors">help</span>
                    <div className="absolute top-full mt-2 right-0 w-72 bg-white shadow-2xl rounded-2xl border border-slate-100 p-4 opacity-0 group-hover/help:opacity-100 transition-all pointer-events-none z-50 scale-95 group-hover/help:scale-100 origin-top-right">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary-container text-sm">info</span>
                        <p className="text-xs font-bold text-primary">{language === 'es' ? 'Centro de Chat' : 'Chat Center'}</p>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {language === 'es' 
                          ? 'Este panel te permite chatear directamente con el contacto en tiempo real, ver su historial completo de conversación, enviar notas rápidas, gestionar etiquetas, ver métricas de IA y analizar el comportamiento del contacto. Puedes tomar control manual del chat o dejar que la IA responda automáticamente.'
                          : 'This panel allows you to chat directly with the contact in real-time, view their complete conversation history, send quick notes, manage tags, view AI metrics, and analyze contact behavior. You can take manual control of the chat or let the AI respond automatically.'}
                      </p>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-primary-container/10 bg-primary flex items-center justify-center text-white text-xs font-bold">
                    AD
                  </div>
                </div>
              </div>
            </header>

            {/* Content Area */}
            <div className="p-8 max-w-7xl w-full mx-auto grid grid-cols-12 gap-8">
              {/* Column 1: Profile & Insights */}
              <div className="col-span-12 lg:col-span-4 space-y-8">
                {/* 1. Header Profile Card */}
                <section className="bg-crm-surface-container-lowest rounded-xl p-8 shadow-[0_24px_24px_rgba(25,28,29,0.02)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 rounded-full -mr-16 -mt-16"></div>
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-crm-surface-container mb-4 bg-primary-container flex items-center justify-center text-white text-3xl font-bold">
                      {selectedChat.name?.substring(0, 2).toUpperCase() || 'U'}
                    </div>
                    {isEditingContact ? (
                      <div className="flex flex-col gap-2 w-full px-4 mt-2">
                        <input 
                          type="text" 
                          value={editName} 
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-crm-surface-container-low border-none rounded-lg px-3 py-1.5 text-center text-on-surface font-bold focus:ring-2 focus:ring-primary-container"
                          placeholder="Nombre"
                        />
                        <input 
                          type="text" 
                          value={editPhone} 
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="bg-crm-surface-container-low border-none rounded-lg px-3 py-1.5 text-center text-secondary font-medium focus:ring-2 focus:ring-primary-container"
                          placeholder="Teléfono"
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="font-display text-2xl font-extrabold text-on-surface tracking-tight">{selectedChat.name || 'Usuario'}</h3>
                        <p className="text-secondary font-medium mt-1 font-body">{selectedChat.phone_number || '+52 55 1234 5678'}</p>
                      </>
                    )}
                    <div className="mt-4 px-4 py-1.5 bg-primary-container text-white text-xs font-bold rounded-full uppercase tracking-widest">
                      {selectedChat.status || 'Chatting'}
                    </div>
                    <div className="grid grid-cols-4 gap-3 w-full mt-8">
                      <button 
                        onClick={async () => {
                          const newPaused = !isHumanMode;
                          const resPatch = await fetch('/api/panel/pause', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ conversationId: selectedChat.id, paused: newPaused }),
                          });
                          if (resPatch.ok) {
                            setIsHumanMode(newPaused);
                            if (newPaused) {
                              setTimeout(() => document.querySelector("textarea")?.focus(), 100);
                            }
                          } else {
                            const errData = await resPatch.json();
                            alert(`Error al cambiar modo: ${errData.error}`);
                          }
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all group ${
                          isHumanMode 
                            ? 'bg-crm-surface-container-highest shadow-inner scale-[0.97] text-on-surface-variant' 
                            : 'bg-crm-surface-container-low shadow-sm hover:bg-primary-container hover:text-white hover:-translate-y-0.5'
                        }`}
                      >
                        <span className={`material-symbols-outlined ${isHumanMode ? 'text-primary' : 'text-primary-container group-hover:text-white'}`}>
                          {isHumanMode ? 'smart_toy' : 'person'}
                        </span>
                        <span className="text-[10px] mt-1 font-bold uppercase text-center leading-tight">
                          {isHumanMode 
                            ? (language === 'en' ? 'To AI' : 'A la IA') 
                            : (language === 'en' ? 'Control' : 'Control')}
                        </span>
                      </button>
                      <button onClick={() => { const phone = (selectedChat.phone_number || '').replace(/[^0-9]/g, ''); if (phone) window.open(`https://wa.me/${phone}`, '_blank'); else alert(language === 'es' ? 'No hay número de teléfono registrado' : 'No phone number registered'); }} className="flex flex-col items-center justify-center p-3 rounded-lg bg-crm-surface-container-low hover:bg-primary-container hover:text-white transition-all group">
                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">call</span>
                        <span className="text-[10px] mt-1 font-bold uppercase">{language === 'en' ? 'Call' : 'Llamar'}</span>
                      </button>
                      <button 
                        onClick={async () => {
                          if (isEditingContact) {
                            // Save logic
                            setIsSaving(true);
                            const res = await fetch('/api/panel/conversations', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: selectedChat.id, name: editName, phone_number: editPhone }),
                            });
                            if (res.ok) {
                              setSelectedChat({ ...selectedChat, name: editName, phone_number: editPhone });
                            } else {
                              alert("Error al guardar contacto");
                            }
                            setIsSaving(false);
                            setIsEditingContact(false);
                          } else {
                            // Enter edit mode
                            setEditName(selectedChat.name || '');
                            setEditPhone(selectedChat.phone_number || '+52 55 1234 5678');
                            setIsEditingContact(true);
                          }
                        }}
                        disabled={isSaving}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all group ${isEditingContact ? 'bg-primary-container text-white' : 'bg-crm-surface-container-low hover:bg-primary-container hover:text-white'}`}
                      >
                        <span className={`material-symbols-outlined ${isEditingContact ? '' : 'text-primary-container group-hover:text-white'}`}>
                          {isEditingContact ? (isSaving ? 'hourglass_empty' : 'save') : 'edit'}
                        </span>
                        <span className="text-[10px] mt-1 font-bold uppercase">
                          {isEditingContact ? (language === 'en' ? 'Save' : 'Guardar') : (language === 'en' ? 'Edit' : 'Editar')}
                        </span>
                      </button>
                      <button onClick={() => alert(language === 'en' ? 'Feature coming soon' : 'Función próximamente')} className="flex flex-col items-center justify-center p-3 rounded-lg bg-crm-surface-container-low hover:bg-primary-container hover:text-white transition-all group">
                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">more_horiz</span>
                        <span className="text-[10px] mt-1 font-bold uppercase">{language === 'en' ? 'More' : 'Más'}</span>
                      </button>
                    </div>
                  </div>
                </section>
                
                {/* 2. AI Intelligence Insights - REAL DATA */}
                <section className="bg-[rgba(75,83,188,0.05)] backdrop-blur-[20px] border border-[rgba(198,197,213,0.2)] rounded-xl p-6 border-l-4 border-l-primary-container">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-primary-container">psychology</span>
                    <h4 className="font-display font-bold text-lg text-primary-container tracking-tight">{language === 'en' ? 'AI Intelligence Profile' : 'Perfil de Inteligencia IA'}</h4>
                  </div>
                  <div className="space-y-6">
                    {/* Propensity Gauge - calculated from conversation */}
                    {(() => {
                      const userMsgs = chatMessages.filter((m: any) => m.role === 'user');
                      const allText = userMsgs.map((m: any) => (m.content || '').toLowerCase()).join(' ');
                      const positiveWords = ['sí', 'si', 'interesa', 'quiero', 'necesito', 'perfecto', 'genial', 'excelente', 'precio', 'costo', 'comprar', 'adquirir', 'contratar', 'plan', 'demo', 'probar', 'información', 'info', 'gracias', 'bueno', 'ok', 'vale', 'claro', 'por supuesto', 'envíame', 'me gustaría', 'cotización', 'presupuesto', 'disponible'];
                      const negativeWords = ['no', 'nunca', 'cancelar', 'eliminar', 'problema', 'mal', 'error', 'queja', 'reclamo', 'molesta', 'spam', 'no me interesa', 'adiós', 'basta', 'deja'];
                      let positiveCount = 0, negativeCount = 0;
                      positiveWords.forEach(w => { if (allText.includes(w)) positiveCount++; });
                      negativeWords.forEach(w => { if (allText.includes(w)) negativeCount++; });
                      const total = positiveCount + negativeCount;
                      const propensity = total === 0 ? 50 : Math.min(98, Math.max(10, Math.round((positiveCount / total) * 100)));
                      
                      // Sentiment
                      const sentiment = propensity >= 70 ? (language === 'es' ? 'Consistentemente Positivo' : 'Consistently Positive') 
                        : propensity >= 40 ? (language === 'es' ? 'Neutral / Explorando' : 'Neutral / Exploring') 
                        : (language === 'es' ? 'Negativo / Desinteresado' : 'Negative / Uninterested');
                      const sentimentIcon = propensity >= 70 ? 'sentiment_very_satisfied' : propensity >= 40 ? 'sentiment_neutral' : 'sentiment_dissatisfied';
                      const sentimentColor = propensity >= 70 ? 'text-emerald-600' : propensity >= 40 ? 'text-amber-500' : 'text-red-500';
                      
                      // Keywords extraction from user messages
                      const stopWords = new Set(['de', 'la', 'el', 'en', 'un', 'una', 'que', 'es', 'y', 'los', 'las', 'por', 'con', 'para', 'del', 'al', 'se', 'lo', 'a', 'no', 'me', 'mi', 'su', 'te', 'le', 'como', 'más', 'ya', 'o', 'pero', 'si', 'hola', 'buenas', 'buenos', 'días', 'tardes', 'noches', 'the', 'is', 'a', 'to', 'and', 'i', 'you', 'it', 'of', 'in', 'this', 'that', 'for', 'on', 'are', 'at', 'be', 'was']);
                      const words = allText.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
                      const freq: Record<string, number> = {};
                      words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
                      const topKeywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));
                      
                      return (
                        <>
                          <div>
                            <div className="flex justify-between items-end mb-2">
                              <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">{language === 'en' ? 'Propensity to Convert' : 'Propensión de Compra'}</span>
                              <span className="text-xl font-extrabold text-primary-container">{propensity}%</span>
                            </div>
                            <div className="h-2 w-full bg-crm-surface-container-highest rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 ${propensity >= 70 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : propensity >= 40 ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gradient-to-r from-red-400 to-red-600'}`} style={{width: `${propensity}%`}}></div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-white/50 rounded-lg">
                            <div>
                              <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{language === 'en' ? 'Sentiment Analysis' : 'Análisis de Sentimiento'}</p>
                              <p className="text-sm font-semibold text-on-surface">{sentiment}</p>
                            </div>
                            <span className={`material-symbols-outlined ${sentimentColor} scale-125`} style={{fontVariationSettings: "'FILL' 1"}}>{sentimentIcon}</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-3">{language === 'en' ? 'Key Intent Keywords' : 'Palabras Clave de Intención'}</p>
                            <div className="flex flex-wrap gap-2">
                              {topKeywords.length > 0 ? topKeywords.map((kw, i) => (
                                <span key={i} className="px-3 py-1 bg-primary-container/10 text-primary-container text-xs font-semibold rounded-md">{kw}</span>
                              )) : (
                                <span className="text-xs text-slate-400">{language === 'es' ? 'Sin suficientes datos aún' : 'Not enough data yet'}</span>
                              )}
                            </div>
                          </div>
                          {/* Email detected */}
                          {detectedEmail && (
                            <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-500 text-sm">mail</span>
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{language === 'es' ? 'Email Detectado' : 'Detected Email'}</p>
                                  <p className="text-xs font-bold text-blue-600">{detectedEmail}</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => { setShowEmailComposer(true); setEmailSubject(''); setEmailBody(''); }}
                                className="px-3 py-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-xs">send</span>
                                {language === 'es' ? 'Enviar Email' : 'Send Email'}
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </section>

                {/* 4. Behavioral Data - REAL */}
                <section className="bg-crm-surface-container-low rounded-xl p-6">
                  <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest mb-4">{language === 'en' ? 'Behavioral Telemetry' : 'Telemetría de Comportamiento'}</h4>
                  {(() => {
                    const totalMsgs = chatMessages.length;
                    const userMsgs = chatMessages.filter((m: any) => m.role === 'user').length;
                    const aiMsgs = totalMsgs - userMsgs;
                    const lastMsg = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;
                    const lastActivity = lastMsg ? formatRelativeTime(lastMsg.created_at, language) : (language === 'es' ? 'Sin actividad' : 'No activity');
                    const lastTime = lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                    const status = selectedChat.status || 'chatting';
                    const statusLabel = status === 'interested' ? (language === 'es' ? 'Interesado' : 'Interested') 
                      : status === 'chatting' ? (language === 'es' ? 'Conversando' : 'Chatting') 
                      : (language === 'es' ? 'Comprador' : 'Buyer');
                    
                    return (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-lg">
                          <p className="text-[10px] font-medium text-slate-400">{language === 'en' ? 'Classification' : 'Clasificación'}</p>
                          <p className="text-sm font-bold text-primary-container">{statusLabel}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg">
                          <p className="text-[10px] font-medium text-slate-400">{language === 'en' ? 'Total Messages' : 'Total Mensajes'}</p>
                          <p className="text-lg font-bold text-primary-container">{totalMsgs}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg">
                          <p className="text-[10px] font-medium text-slate-400">{language === 'en' ? 'User Messages' : 'Mensajes del Usuario'}</p>
                          <p className="text-sm font-bold text-emerald-600">{userMsgs} <span className="text-slate-400 font-normal text-[10px]">/ {aiMsgs} IA</span></p>
                        </div>
                        <div className="bg-white p-3 rounded-lg">
                          <p className="text-[10px] font-medium text-slate-400">{language === 'en' ? 'Response Rate' : 'Tasa de Respuesta'}</p>
                          <p className="text-sm font-bold text-primary-container">{totalMsgs > 0 ? Math.round((userMsgs / totalMsgs) * 100) : 0}%</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg col-span-2">
                          <p className="text-[10px] font-medium text-slate-400">{language === 'en' ? 'Last Activity' : 'Ãšltima Actividad'}</p>
                          <p className="text-sm font-bold text-primary-container">{lastTime} <span className="text-slate-400 font-normal text-[10px]">({lastActivity})</span></p>
                        </div>
                      </div>
                    );
                  })()}
                </section>
              </div>

              {/* Column 2: Timeline & Notes */}
              <div className="col-span-12 lg:col-span-8 space-y-8">
                {/* 3. {language === 'en' ? 'Communication Timeline' : 'Línea de Tiempo de Comunicación'} */}
                <section className="bg-crm-surface-container-lowest rounded-xl shadow-[0_24px_24px_rgba(25,28,29,0.02)] flex flex-col h-[600px]">
                  <div className="p-6 border-b border-surface-container-low flex justify-between items-center">
                    <h4 className="font-display font-bold text-lg">{language === 'es' ? 'Línea de Tiempo' : 'Communication Timeline'}</h4>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-crm-surface-container text-[10px] font-bold rounded cursor-pointer">WhatsApp</span>
                      <span className="px-3 py-1 bg-crm-surface-container-low text-[10px] font-bold rounded cursor-pointer opacity-50">Email</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide" ref={chatContainerRef}>
                    {loadingMessages ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-slate-500 text-sm">{language === 'en' ? 'No messages yet' : 'No hay mensajes aún'}</div>
                    ) : (
                      chatMessages.map((msg: any, idx: number) => {
                        const time = new Date(msg.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
                        const isUser = msg.role === 'user';
                        const msgDate = new Date(msg.created_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
                        const prevDate = idx > 0 ? new Date(chatMessages[idx-1].created_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }) : null;
                        const showDate = idx === 0 || msgDate !== prevDate;
                        
                        const imgMatch = msg.content?.match(/^!\[.*\]\((.*)\)(?:\n([\s\S]*))?/);
                        const isSearchMatch = chatSearch && msg.content?.toLowerCase().includes(chatSearch.toLowerCase());
                        const isCurrentSearchMatch = chatSearchIdx === idx;
                        const renderContent = () => {
                          if (imgMatch) {
                            return (
                              <div className="flex flex-col gap-2">
                                <img src={imgMatch[1]} alt="Adjunto" className="max-w-[240px] w-full rounded-lg object-contain shadow-sm bg-black/5" />
                                {imgMatch[2] && <p className="text-sm leading-relaxed whitespace-pre-wrap">{imgMatch[2]}</p>}
                              </div>
                            );
                          }
                          return <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>;
                        };
                        
                        return (
                          <React.Fragment key={msg.id || idx}>
                            {showDate && (
                              <div className="relative flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center">
                                  <div className="w-full border-t border-surface-container-highest"></div>
                                </div>
                                <span className="relative bg-crm-surface-container-lowest px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{msgDate}</span>
                              </div>
                            )}
                            
                            {isUser ? (
                              <div id={`chat-msg-${idx}`} className={`flex flex-col items-start transition-all ${isCurrentSearchMatch ? 'ring-2 ring-amber-400 rounded-xl bg-amber-50/50 p-1' : isSearchMatch ? 'ring-1 ring-amber-200 rounded-xl p-1' : ''}`}>
                                <div className="max-w-[80%] bg-crm-surface-container-high text-on-surface p-4 rounded-xl rounded-tl-sm">
                                  {renderContent()}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedChat.name} u{2022} {time}</span>
                                </div>
                              </div>
                            ) : (
                              <div id={`chat-msg-${idx}`} className={`flex flex-col items-end transition-all ${isCurrentSearchMatch ? 'ring-2 ring-amber-400 rounded-xl bg-amber-50/50 p-1' : isSearchMatch ? 'ring-1 ring-amber-200 rounded-xl p-1' : ''}`}>
                                <div className="max-w-[80%] bg-primary-container text-white p-4 rounded-xl rounded-tr-sm shadow-sm opacity-90">
                                  {renderContent()}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="material-symbols-outlined text-[14px] text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">AI Sovereign u{2022} {time}</span>
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </div>
                  
                  <div className="p-6 bg-crm-surface-container-low/50">
                    <div className="relative">
                      {isHumanMode ? (
                        <>
                          <div className="relative border border-outline-variant/20 rounded-xl bg-white focus-within:ring-1 focus-within:ring-primary-container focus-within:border-primary-container">
                            {selectedFile && (
                              <div className="absolute top-2 left-4 right-4 flex items-center justify-between bg-crm-surface-container-low p-2 rounded-lg border border-slate-200 z-10">
                                <div className="flex items-center gap-2 truncate">
                                  <span className="material-symbols-outlined text-primary-container text-sm">image</span>
                                  <span className="text-xs font-medium text-slate-700 truncate">{selectedFile.name}</span>
                                </div>
                                <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-red-500">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            <textarea 
                              value={manualMsg}
                              onChange={(e) => setManualMsg(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !sendingMsg) {
                                  e.preventDefault();
                                  handleSendMessage();
                                }
                              }}
                              disabled={sendingMsg}
                              className={`w-full bg-transparent border-none p-4 text-sm outline-none focus:outline-none focus:ring-0 focus:border-transparent min-h-[100px] resize-none text-black ${selectedFile ? 'pt-14' : ''}`}
                              placeholder={language === 'en' ? 'Write your response...' : 'Escribe tu respuesta...'}
                            ></textarea>
                            <div className="absolute bottom-4 right-4 flex gap-2">
                              <input 
                                type="file" 
                                accept="image/*"
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    setSelectedFile(e.target.files[0]);
                                  }
                                }} 
                              />
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 bg-crm-surface-container-highest rounded-lg hover:bg-crm-surface-container-high transition-colors"
                              >
                                <span className="material-symbols-outlined text-on-surface-variant text-sm">attach_file</span>
                              </button>
                              <button 
                                disabled={sendingMsg || (!manualMsg.trim() && !selectedFile)}
                                onClick={handleSendMessage}
                                className="px-6 py-2 bg-gradient-to-r from-primary to-primary-container text-white font-bold text-xs rounded-lg uppercase tracking-widest shadow-md disabled:opacity-50 hover:shadow-lg transition-all"
                              >
                                {sendingMsg ? '...' : 'Send'}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="w-full bg-white/50 border border-outline-variant/20 rounded-xl p-4 text-sm text-slate-400 min-h-[100px] flex items-center justify-center">
                          {language === 'es' ? "La IA está respondiendo de forma autónoma. Haz clic en 'Control' para enviar un mensaje manualmente." : "AI is responding autonomously. Click 'Control' to send a message manually."}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* 5. Notes & Metadata - FUNCTIONAL */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Operator Notes - Quick Message Templates */}
                  <div className="bg-crm-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_rgba(25,28,29,0.01)] border-t-2 border-secondary">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-widest">{language === 'es' ? 'Notas del Operador' : 'Operator Notes'}</h4>
                      <button 
                        onClick={() => setShowAddNote(!showAddNote)}
                        className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-slate-400 text-sm">{showAddNote ? 'close' : 'add'}</span>
                      </button>
                    </div>
                    
                    {/* Add note form */}
                    {showAddNote && (
                      <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <textarea
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          placeholder={language === 'es' ? 'Escribe una nota o plantilla de mensaje rápido...' : 'Write a note or quick message template...'}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary-container/30 text-black"
                          rows={2}
                        />
                        <button
                          onClick={() => {
                            if (newNoteText.trim()) {
                              setOperatorNotes(prev => [...prev, { id: Date.now().toString(), text: newNoteText.trim(), createdAt: new Date().toISOString() }]);
                              setNewNoteText('');
                              setShowAddNote(false);
                            }
                          }}
                          disabled={!newNoteText.trim()}
                          className="mt-2 w-full px-3 py-1.5 bg-primary-container text-white text-[10px] font-bold rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
                        >
                          {language === 'es' ? '+ Guardar Plantilla' : '+ Save Template'}
                        </button>
                      </div>
                    )}

                    {/* Notes list */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {operatorNotes.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-4">{language === 'es' ? 'Sin notas. Agrega plantillas de mensajes rápidos.' : 'No notes. Add quick message templates.'}</p>
                      ) : operatorNotes.map(note => (
                        <div key={note.id} className="group/note flex items-start gap-2 p-2.5 bg-slate-50/50 hover:bg-primary-container/5 rounded-lg border border-transparent hover:border-primary-container/10 transition-all cursor-pointer"
                          onClick={async () => {
                            if (!isHumanMode) {
                              // First pause AI
                              const resPause = await fetch('/api/panel/pause', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ conversationId: selectedChat.id, paused: true }),
                              });
                              if (resPause.ok) setIsHumanMode(true);
                            }
                            // Send message
                            const formData = new FormData();
                            formData.append('conversationId', selectedChat.id);
                            formData.append('message', note.text);
                            await fetch('/api/panel/send-message', { method: 'POST', body: formData });
                          }}
                        >
                          <span className="material-symbols-outlined text-primary-container text-sm mt-0.5 opacity-0 group-hover/note:opacity-100 transition-opacity">send</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">{note.text}</p>
                            <p className="text-[9px] text-slate-400 mt-1">{formatRelativeTime(note.createdAt, language)}</p>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOperatorNotes(prev => prev.filter(n => n.id !== note.id)); }}
                            className="p-0.5 hover:bg-red-50 rounded text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover/note:opacity-100"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-3 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[9px]">info</span>
                      {language === 'es' ? 'Haz clic en una nota para enviarla al chat' : 'Click a note to send it to chat'}
                    </p>
                  </div>

                  {/* System Tags - DYNAMIC */}
                  <div className="bg-crm-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_rgba(25,28,29,0.01)] border-t-2 border-primary-container">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-widest">{language === 'en' ? 'System Metadata' : 'Metadatos del Sistema'}</h4>
                      <span className="material-symbols-outlined text-slate-300 text-sm">label</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* Dynamic tags for this conversation */}
                      {(chatTags[selectedChat.id] || []).map((tag, i) => {
                        const colorMap: Record<string, string> = { emerald: 'bg-emerald-500', blue: 'bg-blue-500', amber: 'bg-amber-500', purple: 'bg-purple-500', red: 'bg-red-500', pink: 'bg-pink-500', cyan: 'bg-cyan-500' };
                        return (
                          <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-crm-surface-container-low rounded text-[10px] font-bold text-on-surface group/tag">
                            <span className={`w-1.5 h-1.5 rounded-full ${colorMap[tag.color] || 'bg-slate-400'}`}></span>
                            {tag.text.toUpperCase()}
                            <button onClick={() => {
                              setChatTags(prev => ({
                                ...prev,
                                [selectedChat.id]: (prev[selectedChat.id] || []).filter((_, idx) => idx !== i)
                              }));
                            }} className="ml-0.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover/tag:opacity-100">
                              <span className="material-symbols-outlined text-[10px]">close</span>
                            </button>
                          </div>
                        );
                      })}

                      {/* Add tag form */}
                      {showAddTag ? (
                        <div className="flex items-center gap-1">
                          <input 
                            type="text" 
                            value={newTagText}
                            onChange={(e) => setNewTagText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newTagText.trim()) {
                                setChatTags(prev => ({
                                  ...prev,
                                  [selectedChat.id]: [...(prev[selectedChat.id] || []), { text: newTagText.trim(), color: newTagColor }]
                                }));
                                setNewTagText('');
                                setShowAddTag(false);
                              } else if (e.key === 'Escape') {
                                setShowAddTag(false);
                              }
                            }}
                            placeholder={language === 'es' ? 'Etiqueta...' : 'Tag...'}
                            className="w-20 px-2 py-1 text-[10px] border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary-container/30 text-black"
                            autoFocus
                          />
                          <select 
                            value={newTagColor} 
                            onChange={(e) => setNewTagColor(e.target.value)}
                            className="text-[9px] border border-slate-200 rounded px-1 py-1 bg-white text-black"
                          >
                            <option value="emerald">Verde</option>
                            <option value="blue">Azul</option>
                            <option value="amber">Naranja</option>
                            <option value="purple">Morado</option>
                            <option value="red">Rojo</option>
                            <option value="pink">Rosa</option>
                            <option value="cyan">Cian</option>
                          </select>
                          <button 
                            onClick={() => {
                              if (newTagText.trim()) {
                                setChatTags(prev => ({
                                  ...prev,
                                  [selectedChat.id]: [...(prev[selectedChat.id] || []), { text: newTagText.trim(), color: newTagColor }]
                                }));
                                setNewTagText('');
                                setShowAddTag(false);
                              }
                            }}
                            className="text-primary-container hover:text-primary"
                          >
                            <span className="material-symbols-outlined text-sm">check</span>
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setShowAddTag(true)}
                          className="px-3 py-1.5 border border-dashed border-outline-variant rounded text-[10px] font-bold text-slate-400 hover:border-primary-container hover:text-primary-container transition-all"
                        >
                          + {language === 'es' ? 'AGREGAR ETIQUETA' : 'ADD TAG'}
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* EMAIL COMPOSER MODAL */}
            {showEmailComposer && detectedEmail && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] flex items-center justify-center p-4" onClick={() => setShowEmailComposer(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="bg-gradient-to-r from-blue-500 to-blue-700 p-5 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined">mail</span>
                        <div>
                          <h3 className="font-bold">{language === 'es' ? 'Enviar Email' : 'Send Email'}</h3>
                          <p className="text-white/70 text-xs">{language === 'es' ? `Para: ${detectedEmail}` : `To: ${detectedEmail}`}</p>
                        </div>
                      </div>
                      <button onClick={() => setShowEmailComposer(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">{language === 'es' ? 'Asunto' : 'Subject'}</label>
                      <input 
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder={language === 'es' ? 'Ej: Seguimiento de nuestra conversación' : 'E.g.: Follow-up on our conversation'}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 text-black"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Contenido' : 'Content'}</label>
                        <button
                          onClick={async () => {
                            setIsGeneratingEmail(true);
                            try {
                              const res = await fetch('/api/panel/generate-email', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  contactId: selectedChat.id, 
                                  prompt: language === 'es' ? 'Redacta un correo de seguimiento profesional.' : 'Write a professional follow-up email.' 
                                }),
                              });
                              const data = await res.json();
                              if (data.body) {
                                setEmailSubject(data.subject || (language === 'es' ? 'Seguimiento de nuestra conversación' : 'Follow-up on our conversation'));
                                setEmailBody(data.body);
                              } else {
                                throw new Error('No body');
                              }
                            } catch { 
                              setEmailBody(language === 'es' ? `Hola ${selectedChat.name?.split(' ')[0] || ''},\n\nGracias por tu interés en nuestros servicios. Quería dar seguimiento a nuestra conversación reciente.\n\nQuedo atento a tus comentarios.\n\nSaludos cordiales,\nEquipo RIFX` : `Hi ${selectedChat.name?.split(' ')[0] || ''},\n\nThank you for your interest in our services. I wanted to follow up on our recent conversation.\n\nI look forward to hearing from you.\n\nBest regards,\nRIFX Team`);
                            }
                            setIsGeneratingEmail(false);
                          }}
                          disabled={isGeneratingEmail}
                          className="text-[10px] font-bold text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          {isGeneratingEmail ? (
                            <><div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" /> {language === 'es' ? 'Generando...' : 'Generating...'}</>
                          ) : (
                            <><span className="material-symbols-outlined text-xs">auto_awesome</span> {language === 'es' ? 'Generar con IA' : 'Generate with AI'}</>
                          )}
                        </button>
                      </div>
                      <textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        rows={6}
                        placeholder={language === 'es' ? 'Escribe el contenido del email o genera uno con IA...' : 'Write the email content or generate one with AI...'}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none text-black"
                      />
                    </div>
                    <button
                      onClick={() => {
                        // Open mailto link
                        const subject = encodeURIComponent(emailSubject || `Seguimiento - ${selectedChat.name}`);
                        const body = encodeURIComponent(emailBody);
                        window.open(`mailto:${detectedEmail}?subject=${subject}&body=${body}`, '_blank');
                        setShowEmailComposer(false);
                      }}
                      disabled={!emailBody.trim()}
                      className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-sm">send</span>
                      {language === 'es' ? 'Enviar Email' : 'Send Email'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}

    </>
  );
}

