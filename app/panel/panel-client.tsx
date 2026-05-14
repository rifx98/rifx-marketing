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

export default function PanelClient() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'crm' | 'settings' | 'billing' | 'playground'>('dashboard');
  const [language, setLanguage] = useState<'es'|'en'>('es');
  const [showWhatsappPanel, setShowWhatsappPanel] = useState(false);
  const [currentPlan, setCurrentPlan] = useState('trial');
  const [showPlanConfirm, setShowPlanConfirm] = useState<any>(null);
  const [selectedChat, setSelectedChat] = useState<{id: string, name: string, status: string} | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);
  const [manualMsg, setManualMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [isHumanMode, setIsHumanMode] = useState(false);
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
    openai_key: '',
    ai_prompt: '',
    panel_password: '',
  });
  const [showWhatsappKey, setShowWhatsappKey] = useState(false);
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);

  React.useEffect(() => {
    if (isLoggedIn) {
      // Cargar CRM
      fetch('/api/panel/conversations')
        .then(res => res.json())
        .then(data => {
          setConversationsData(data);
          // Detectar alertas de solicitud de humano
          checkHumanAlerts(data);
        })
        .catch(console.error);
      
      // Cargar Estadísticas
      fetch('/api/panel/stats')
        .then(res => res.json())
        .then(data => setStatsData(data))
        .catch(console.error);

      // Cargar Config
      fetch('/api/panel/config')
        .then(res => res.json())
        .then(data => {
           if (!data.error) {
             // Solo guardar campos válidos de la DB, no campos extra como hasWhatsappToken
             setConfigData({
               whatsapp_token: data.whatsapp_token || '',
               whatsapp_phone_id: data.whatsapp_phone_id || '',
               openai_key: data.openai_key || '',
               payphone_token: data.payphone_token || '',
               payphone_store_id: data.payphone_store_id || '',
               ai_prompt: data.ai_prompt || '',
               panel_password: data.panel_password || '',
             });
           }
        })
        .catch(console.error);

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
        payphone_token: configData.payphone_token,
        payphone_store_id: configData.payphone_store_id,
        ai_prompt: configData.ai_prompt,
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
      <div className="min-h-screen bg-[#050505] text-slate-800 flex items-center justify-center p-6 font-sans relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-[-30%] right-[-20%] w-[700px] h-[700px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[-30%] left-[-20%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md relative z-10"
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30 mb-4">
              <Bot className="w-8 h-8 text-slate-800" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">RIFX Panel</h1>
            <p className="text-sm text-gray-500 mt-1">Panel de Control IA — WhatsApp Sales Bot</p>
          </div>

          {/* Login Card */}
          <form onSubmit={handleLogin} className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-2 mb-6">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold">Iniciar Sesión</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Usuario</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    placeholder="Escribe tu usuario"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-800 placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-slate-800 placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
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
                    className="text-red-400 text-sm flex items-center gap-1 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg"
                  >
                    <X className="w-4 h-4" /> {loginError}
                  </motion.p>
                )}
    
            {/* ----------------- TAB: BILLING ----------------- */}
            {activeTab === 'billing' && (
              <motion.div key="billing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="space-y-8">
                <div className="text-center max-w-2xl mx-auto mb-8">
                  <h2 className="text-3xl font-extrabold text-primary font-headline mb-3">{language === 'en' ? 'Choose Your Plan' : 'Escoge tu Plan'}</h2>
                  <p className="text-slate-500">{language === 'en' ? 'Scale your business with the right plan' : 'Escala tu negocio con el plan ideal'}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {[
                    { id: 'trial', name: 'Prueba', price: 0, period: '14 dias', contacts: 200, bots: 1, members: 1, storage: '1 GB', popular: false },
                    { id: 'start', name: 'Start', price: 49, period: '/mes', contacts: 1000, bots: 2, members: 3, storage: '5 GB', popular: false },
                    { id: 'advanced', name: 'Advanced', price: 99, period: '/mes', contacts: 5000, bots: 5, members: 5, storage: '15 GB', popular: true },
                    { id: 'plus', name: 'Plus', price: 199, period: '/mes', contacts: 20000, bots: 10, members: 10, storage: '50 GB', popular: false },
                    { id: 'master', name: 'Master', price: 499, period: '/mes', contacts: 100000, bots: 50, members: 25, storage: '200 GB', popular: false },
                  ].map((plan) => (
                    <div key={plan.id} className={`relative bg-white rounded-2xl border ${plan.popular ? 'border-primary-container shadow-lg shadow-primary-container/10 ring-2 ring-primary-container/20' : 'border-slate-200 shadow-sm'} p-6 flex flex-col transition-all hover:shadow-md`}>
                      {plan.popular && (<div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-container text-white text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider">{language === 'en' ? 'Most Popular' : 'Mas Popular'}</div>)}
                      <h3 className="text-lg font-extrabold text-primary mb-1">{plan.name}</h3>
                      <div className="flex items-baseline gap-1 mb-4"><span className="text-3xl font-black text-slate-800">${plan.price}</span><span className="text-sm text-slate-400 font-medium">{plan.period}</span></div>
                      <div className="space-y-2.5 flex-1 mb-6">
                        <div className="flex items-center gap-2 text-sm text-slate-600"><span className="material-symbols-outlined text-primary-container text-base">group</span><span>{plan.contacts.toLocaleString()} contactos</span></div>
                        <div className="flex items-center gap-2 text-sm text-slate-600"><span className="material-symbols-outlined text-primary-container text-base">smart_toy</span><span>{plan.bots} bots IA</span></div>
                        <div className="flex items-center gap-2 text-sm text-slate-600"><span className="material-symbols-outlined text-primary-container text-base">people</span><span>{plan.members} miembros</span></div>
                        <div className="flex items-center gap-2 text-sm text-slate-600"><span className="material-symbols-outlined text-primary-container text-base">cloud</span><span>{plan.storage}</span></div>
                      </div>
                      <button onClick={() => setShowPlanConfirm(plan)} className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${currentPlan === plan.id ? 'bg-slate-100 text-slate-400 cursor-default' : plan.popular ? 'bg-primary-container text-white hover:bg-primary-container/90 shadow-sm' : 'bg-slate-100 text-primary hover:bg-primary-container hover:text-white'}`} disabled={currentPlan === plan.id}>
                        {currentPlan === plan.id ? (language === 'en' ? 'Current Plan' : 'Plan Actual') : (language === 'en' ? 'Select' : 'Seleccionar')}
                      </button>
                    </div>
                  ))}
                </div>
                <AnimatePresence>
                  {showPlanConfirm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border border-slate-200">
                        <h3 className="text-xl font-extrabold text-primary mb-2">{language === 'en' ? 'Confirm Plan' : 'Confirmar Plan'}</h3>
                        <p className="text-slate-500 text-sm mb-6">{language === 'en' ? `Subscribe to ${showPlanConfirm.name} for $${showPlanConfirm.price}${showPlanConfirm.period}` : `Suscribirte al plan ${showPlanConfirm.name} por $${showPlanConfirm.price}${showPlanConfirm.period}`}</p>
                        <div className="bg-slate-50 rounded-xl p-4 mb-6 space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-slate-500">Contactos</span><span className="font-bold text-slate-800">{showPlanConfirm.contacts.toLocaleString()}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Bots IA</span><span className="font-bold text-slate-800">{showPlanConfirm.bots}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Miembros</span><span className="font-bold text-slate-800">{showPlanConfirm.members}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Almacenamiento</span><span className="font-bold text-slate-800">{showPlanConfirm.storage}</span></div>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => setShowPlanConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">{language === 'en' ? 'Cancel' : 'Cancelar'}</button>
                          <button onClick={() => { setCurrentPlan(showPlanConfirm.id); setShowPlanConfirm(null); }} className="flex-1 py-2.5 rounded-xl bg-primary-container text-white text-sm font-bold hover:bg-primary-container/90 shadow-sm transition-all">{language === 'en' ? 'Confirm' : 'Confirmar Pago'}</button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ----------------- TAB: PLAYGROUND IA ----------------- */}
            {activeTab === 'playground' && (
              <motion.div key="playground" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="space-y-6">
                <div className="grid grid-cols-12 gap-6 h-[calc(100vh-180px)]">
                  <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <div className="bg-primary-container p-4 text-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg"><span className="material-symbols-outlined">smart_toy</span></div>
                        <div><h3 className="font-bold">{language === 'en' ? 'AI Test Console' : 'Consola de Pruebas IA'}</h3><p className="text-xs text-white/70">{language === 'en' ? 'Test your AI agent' : 'Prueba tu agente IA'}</p></div>
                      </div>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto bg-slate-50 space-y-4">
                      <div className="flex justify-start"><div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[75%] shadow-sm"><p className="text-sm text-slate-700">{language === 'en' ? 'Hello! I am your AI assistant. How can I help you?' : '\u00a1Hola! Soy tu asistente IA. \u00bfEn qu\u00e9 puedo ayudarte?'}</p><p className="text-[10px] text-slate-400 mt-1">AI Agent</p></div></div>
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
                      <input type="text" placeholder={language === 'en' ? 'Type a test message...' : 'Escribe un mensaje de prueba...'} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-container/50 focus:ring-1 focus:ring-primary-container/30 transition-all" />
                      <button className="px-5 py-3 bg-primary-container text-white rounded-xl font-bold text-sm hover:bg-primary-container/90 transition-all shadow-sm flex items-center gap-2"><span className="material-symbols-outlined text-lg">send</span></button>
                    </div>
                  </div>
                  <div className="col-span-12 lg:col-span-4 space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                      <h4 className="font-bold text-primary mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary-container">tune</span>{language === 'en' ? 'Model Settings' : 'Configuraci\u00f3n del Modelo'}</h4>
                      <div className="space-y-3">
                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">{language === 'en' ? 'Provider' : 'Proveedor'}</label><select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-primary-container/50"><option>Groq (Llama 3)</option><option>OpenAI (GPT-4)</option><option>Google (Gemini Pro)</option></select></div>
                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">{language === 'en' ? 'Temperature' : 'Temperatura'}</label><input type="range" min="0" max="100" defaultValue="70" className="w-full accent-primary-container" /><div className="flex justify-between text-[10px] text-slate-400"><span>{language === 'en' ? 'Precise' : 'Preciso'}</span><span>{language === 'en' ? 'Creative' : 'Creativo'}</span></div></div>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                      <h4 className="font-bold text-primary mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary-container">security</span>{language === 'en' ? 'Guardrails' : 'Seguridad'}</h4>
                      <div className="space-y-3">
                        {[{label: language === 'en' ? 'Block explicit content' : 'Bloquear contenido expl\u00edcito', checked: true},{label: language === 'en' ? 'Limit to business topics' : 'Limitar a temas de negocio', checked: true},{label: language === 'en' ? 'Auto-escalate to human' : 'Auto-escalar a humano', checked: false}].map((g, i) => (<label key={i} className="flex items-center gap-3 cursor-pointer"><input type="checkbox" defaultChecked={g.checked} className="w-4 h-4 rounded accent-primary-container" /><span className="text-sm text-slate-600">{g.label}</span></label>))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-slate-800 rounded-xl font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
              >
                {isLoggingIn ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                {isLoggingIn ? 'Verificando...' : 'Acceder al Panel'}
              </button>
            </div>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">Protegido con encriptación de extremo a extremo 🔒</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
    {/* Google Material Symbols */}
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    
    <div className="min-h-screen max-h-screen bg-background text-on-surface flex font-body selection:bg-primary-container/20 overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-crm-surface-container-low border-r border-outline-variant/20 flex flex-col h-screen shrink-0 fixed z-30">
        <div className="p-6 flex items-center gap-3 border-b border-outline-variant/10">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center shadow-lg shadow-primary-container/20">
            <span className="material-symbols-outlined text-slate-800 text-xl">smart_toy</span>
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-primary font-headline">Chatea Pro</h1>
            <p className="text-[10px] text-primary-container font-bold tracking-widest uppercase">CRM Platform</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <button onClick={() => setActiveTab('dashboard')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'dashboard' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>dashboard</span>
            <span>{language === 'en' ? 'Dashboard' : 'Panel'}</span>
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
        </nav>

        <div className="p-4 border-t border-outline-variant/10">
          <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-primary hover:bg-white/50 transition-all w-full text-sm">
            <span className="material-symbols-outlined text-lg">logout</span>
            <span className="font-medium">{language === 'en' ? 'Back to Site' : 'Volver a la Web'}</span>
          </Link>
        </div>
      </aside>

      {/* TopAppBar */}
      <div className="fixed top-0 left-64 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-outline-variant/15 z-20 flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-primary font-headline tracking-tight">
            {activeTab === 'dashboard' && (language === 'en' ? 'Dashboard' : 'Panel Principal')}
            {activeTab === 'crm' && (language === 'en' ? 'Users & CRM' : 'Usuarios & CRM')}
            {activeTab === 'settings' && (language === 'en' ? 'Settings' : 'Configuraciones')}
            {activeTab === 'billing' && (language === 'en' ? 'Plans & Billing' : 'Pagos & Suscripciones')}
            {activeTab === 'playground' && (language === 'en' ? 'AI Playground' : 'Playground IA')}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLanguage(language === 'es' ? 'en' : 'es')} className="px-2.5 py-1.5 bg-crm-surface-container-low border border-outline-variant/20 rounded-lg text-[11px] font-bold text-primary-container hover:bg-crm-surface-container transition-colors flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">translate</span>
            {language === 'es' ? 'ES' : 'EN'}
          </button>
          <div className="relative">
            <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors">notifications</span>
            {humanAlerts.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-error text-slate-800 text-[9px] font-bold flex items-center justify-center rounded-full">{humanAlerts.length}</span>}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-10 relative overflow-y-auto min-h-0">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto">
          <header className="mb-10 flex justify-between items-end">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-2">
                {activeTab === 'dashboard' && 'Panel de Ventas IA'}
                {activeTab === 'crm' && 'Contactos & Leads'}
                {activeTab === 'settings' && 'Configuración del Bot'}
              </h2>
              <p className="text-gray-400">
                {activeTab === 'dashboard' && 'Monitoriza las ventas cerradas automáticamente por tu agente de WhatsApp.'}
                {activeTab === 'crm' && 'Da seguimiento a las personas que interactúan con tu IA en tiempo real.'}
                {activeTab === 'settings' && 'Ajusta las credenciales de conexión y el comportamiento de tu vendedor IA.'}
              </p>
            </motion.div>
          </header>

          <AnimatePresence mode="wait">
            {/* ----------------- TAB: DASHBOARD ----------------- */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                {/* MainContent Grid */}
                <div className="grid grid-cols-12 gap-6">
                  {/* LeftPromoBanner */}
                  <section className="col-span-12 lg:col-span-3">
                    <div className="relative rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-100 h-full min-h-[600px] flex flex-col">
                      <div className="h-full w-full relative bg-cover bg-center" style={{backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCkFYKNPmbOfDrJR4jvreG_YAPMRT6PP7fnlw6HOCUOsp_07W4lfKECuFOFvYiQimv7oQJVF3mJFDgl7qUROOStziAkQTW2x3ZNFDZTJ5KivlAzS3pz7t66XaKXadK_n4asnSMe75p9QXMAYGkOYs9xPZqK9gDhBsv6Qg306ADaOTsis2-EkWk5jOiHvptmIGfd0_hVGXOEAWX-UQBCgUEBk0tIGZ3jzifT5-w-vUw8XGQmVYsOckh8gwz9K7Yxy9TQWdIpelgZRWGz')", backgroundPosition: 'left center'}}>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent lg:hidden"></div>
                        <div className="relative z-10 p-8 flex flex-col h-full justify-between">
                          <div className="space-y-4">
                            <span className="inline-block bg-red-600 text-slate-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Nuevo</span>
                            <h2 className="text-3xl font-extrabold text-slate-900 leading-tight">
                              \u00a1Ya est\u00e1 disponible la nueva <span className="text-primary-container">Academia Chatea Pro V2!</span>
                            </h2>
                            <p className="text-slate-700 text-lg">Aprende a manejar la herramienta <span className="font-bold underline decoration-primary-container">como un experto</span>.</p>
                          </div>
                          <div className="mt-auto">
                            <button className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-50 transition-all flex items-center gap-2">
                              Ir a la academia
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" fillRule="evenodd"></path></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* RightDashboardArea */}
                  <section className="col-span-12 lg:col-span-9 space-y-6">
                    {/* ExpertTeamSection */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="bg-primary-container p-4 flex justify-between items-center text-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/20 p-2 rounded-lg">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                          </div>
                          <div>
                            <h3 className="font-bold text-lg leading-none">Equipo de Expertos IA</h3>
                            <p className="text-xs text-slate-800/80 mt-1">0 de 4 expertos activos</p>
                          </div>
                        </div>
                      </div>
                      {/* Plan Info Bar */}
                      <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-primary-container/20 text-primary-container p-1.5 rounded">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                          </div>
                          <div className="text-xs">
                            <p className="font-semibold text-slate-600">Plan actual</p>
                            <p className="text-primary-container">Prueba gratuita (14 d\u00edas)</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-lg font-bold text-slate-800 leading-none">14 / <span className="text-slate-400 font-normal">14</span></p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-tight">d\u00edas usados</p>
                          </div>
                          <div className="flex gap-2">
                            <div className="bg-primary-container/10 px-2 py-1 rounded text-[10px] font-bold text-primary-container border border-primary-container/20">1/200</div>
                            <div className="bg-green-50 px-2 py-1 rounded text-[10px] font-bold text-green-600 border border-green-100">1/1</div>
                            <div className="bg-orange-50 px-2 py-1 rounded text-[10px] font-bold text-orange-600 border border-orange-100">0/1.0 GB</div>
                          </div>
                        </div>
                      </div>
                      {/* Expert Cards */}
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {[
                          {name:'Experta en ventas WhatsApp', img:'AB6AXuDWSe1_L4wZI5vciZ440fFRXGRX_Jy9mCsJqKWeDk4HE-Ljl3Gu1E5Pv7_L5NcYJqr2ETTpZFeExyCE2XypIEK2vjXJ0SCDYSJq2e6JfyCMI1LiPfaGw-Rc7j5TAylDR9nwUkBTwNbCNVnfE-Vc3MP-d0zr9TEtqCyQ8oWyL8YTEdNqstELBp_-riW1gRIx0nsqFnvVXus0zVvMi-eEMcgGTj2vSQ5OntWsKkBqzkLYJ0jOJrd9yO6AC96gavZF11KkwhvPXDVE5YNa', online:true},
                          {name:'Experto en log\u00edstica', img:'AB6AXuBarYnXjTbS-YJFpfnLAYCtwnxMj4ecyo7lrGhGhkFAUtOluIPILBVpU9s63y6cW4s4lP4roXHMufp8eRBhm9RUVHPxC3cg8rWAbH5PnPjYIn_DSTgbolwSjPY1h_8tkVvEHCoOA7w0CWds5V9KapKNkkL2WPLYK_nhweD_by8E8fCUJRTw51XISU4En28JsnHZJRL9c262ihr6zZc44qvxfM0aPZbmQkEHOHvu_FgXciisI5QLgbr7Fn3B3Lb4oKTrGQeoaDrxd3ns', online:false},
                          {name:'Especialista en carritos', img:'AB6AXuDw1TVF3SLRu-VMyIJGiH1m5ts4tKm4LYiPHm4oxOyzu3eZ_T6mp7gbMK1PN5IaC9_tDFYa3xZJoovjUvZg8iCJMP_kOlN5-m9zgjdYRo-U3LC3iIN38ckThN3YvkwB2ufNpLclTsPRElladsSOymDJYSApwZt1bcyG9Y4l_O17x3T0dcXG6tAXzDx21fulMb7Ife5-VDGCD7DiKXVMZBDR1EV7e-RLU_uKmpb4mA_pBVEcgwJ6bYZ_P0KPerwVqyi0AC1o6aH42daD', online:true},
                          {name:'Mediadora de comentarios', img:'AB6AXuC1YTh3EdBAV_bv7N9aDXXB4YN4CgT4dUWwGTMvsPQesCRs_6YrPjx0uQKlZaivH1UYEwHBjzm6RR8Z2yImFDqmeDTukmPil6BBLbJzstpdCzuXxpsSk6GxYtJ4ak2QExlzDvVUEtlXnYtSq_qHXrhHTEo732Sm8qtAxRNcl_xxYh7WQ1zHQsDR6eXrqLTR4bNRzDvRw90ND0ODSVcSrkaliCv_GTtiJ9v0CUnnM_9_xwIhh-1bxMhpg9ymyIw4DaUREtW32ruDnX7J', online:true},
                        ].map((expert, i) => (
                          <div key={i} className="bg-crm-surface-container-low border border-slate-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                            <div className="relative w-20 h-20 mx-auto mb-4">
                              <img alt={expert.name} className="rounded-full w-full h-full object-cover border-2 border-white shadow-sm" src={`https://lh3.googleusercontent.com/aida-public/${expert.img}`} />
                              <span className={`absolute bottom-1 right-1 w-4 h-4 ${expert.online ? 'bg-green-500' : 'bg-slate-300'} border-2 border-white rounded-full`}></span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">{expert.name}</h4>
                            <p className={`text-xs font-medium mt-1 ${expert.online ? 'text-primary-container' : 'text-slate-400'}`}>{expert.online ? 'Disponible' : 'Desconectado'}</p>
                          </div>
                        ))}
                      </div>
                      {/* CTA Bar */}
                      <div className="bg-primary-container/5 px-6 py-4 border-t border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-primary">
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" fillRule="evenodd"></path></svg>
                          <span className="text-sm font-semibold">Te faltan 4 expertos para optimizar tu flujo</span>
                        </div>
                        <button className="bg-primary text-slate-800 px-6 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 shadow-sm transition-all flex items-center gap-2">
                          Completar equipo
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Updates */}
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                        <div className="bg-secondary p-4 flex justify-between items-center text-slate-800 rounded-t-2xl">
                          <div>
                            <h3 className="font-bold text-lg leading-none">Actualizaciones</h3>
                            <p className="text-xs text-slate-800/70 mt-1">Nuevas funciones disponibles</p>
                          </div>
                          <div className="relative">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            <span className="absolute -top-1 -right-1 bg-white text-secondary text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">4</span>
                          </div>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                          <div className="border border-secondary/20 bg-secondary/5 rounded-xl p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded uppercase">Video soluci\u00f3n</span>
                              <span className="text-[10px] text-slate-400 font-medium uppercase">30 ene 2026</span>
                            </div>
                            <h5 className="text-sm font-bold text-slate-800 mb-1">Error de m\u00e9todo de pago en Meta</h5>
                            <p className="text-xs text-slate-600">Hemos publicado un video instructivo para solucionar el error com\u00fan de validaci\u00f3n de tarjetas...</p>
                          </div>
                          <div className="border border-secondary/20 bg-secondary/5 rounded-xl p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded uppercase">Nuevo</span>
                              <span className="text-[10px] text-slate-400 font-medium uppercase">20 ene 2026</span>
                            </div>
                            <h5 className="text-sm font-bold text-slate-800 mb-1">Panel de notificaciones de ventas</h5>
                            <p className="text-xs text-slate-600">Recibe alertas autom\u00e1ticas en tiempo real cada vez que un cliente complete un pago.</p>
                          </div>
                        </div>
                      </div>

                      {/* Trainings */}
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                        <div className="bg-primary-container p-4 flex justify-between items-center text-slate-800 rounded-t-2xl">
                          <div>
                            <h3 className="font-bold text-lg leading-none">Capacitaciones</h3>
                            <p className="text-xs text-slate-800/70 mt-1">Pr\u00f3ximas sesiones importantes</p>
                          </div>
                          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                          <div className="border border-primary-container/10 rounded-xl p-4 hover:border-primary-container/30 transition-colors">
                            <h5 className="text-sm font-bold text-slate-800 mb-2">Primeros pasos de Chatea PRO</h5>
                            <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                              <div className="flex items-center gap-1.5">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                <span>Lunes a Viernes</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                <span>03:00 p.m. \u2022 60 min</span>
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button className="text-primary-container text-xs font-bold flex items-center gap-1 hover:underline">Ingresar <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg></button>
                            </div>
                          </div>
                          <div className="border border-primary-container/10 rounded-xl p-4 hover:border-primary-container/30 transition-colors">
                            <h5 className="text-sm font-bold text-slate-800 mb-2">Preguntas y respuestas con soporte</h5>
                            <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                              <div className="flex items-center gap-1.5">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                <span>Martes y Jueves</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                <span>04:30 p.m. \u2022 45 min</span>
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button className="text-primary-container text-xs font-bold flex items-center gap-1 hover:underline">Ingresar <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </motion.div>
            )}

            {/* ----------------- TAB: CRM / LEADS ----------------- */}
            {activeTab === 'crm' && (
              <motion.div
                key="crm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                {/* 🚨 Human Request Alerts */}
                <AnimatePresence>
                  {humanAlerts.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-gradient-to-r from-red-500/20 via-orange-500/15 to-red-500/20 border border-red-500/40 rounded-2xl p-4 backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-red-500/30 flex items-center justify-center animate-pulse">
                          <Bell className="w-4 h-4 text-red-400" />
                        </div>
                        <div>
                          <h4 className="font-bold text-red-300 text-sm">🚨 Solicitud de Atención Humana</h4>
                          <p className="text-xs text-red-400/70">{humanAlerts.length} cliente{humanAlerts.length > 1 ? 's' : ''} pidiendo hablar con un humano</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {humanAlerts.map((alert) => (
                          <div key={alert.id} className="flex items-center justify-between bg-black/30 rounded-xl px-4 py-2.5 border border-red-500/20">
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="w-4 h-4 text-orange-400" />
                              <div>
                                <p className="text-sm font-medium text-slate-800">{alert.name}</p>
                                <p className="text-[10px] text-gray-400">Solicitó a las {alert.time}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedChat({id: alert.id, name: alert.name, status: 'chatting'})}
                              className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg text-xs font-medium text-orange-300 transition-all"
                            >
                              👤 Atender
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {/* Column 1: Chateando */}
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl flex flex-col h-[35vh] md:h-[70vh]">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-pink-400" />
                      Chateando Ahora
                    </h3>
                    <span className="bg-white/10 text-xs px-2 py-1 rounded-full">{conversationsData?.chatting?.length || 0}</span>
                  </div>
                  <div className="p-4 space-y-4 overflow-y-auto flex-1">
                    {(conversationsData?.chatting || []).map((conv: any) => (
                      <div 
                        key={conv.id} 
                        onClick={() => setSelectedChat({id: conv.id, name: conv.customer_name, status: conv.status})}
                        className="bg-white/[0.03] p-4 rounded-xl border border-white/5 hover:border-pink-500/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-pink-300" />
                          </div>
                          <div>
                            <p className="text-sm font-medium truncate max-w-[120px]">{conv.customer_name}</p>
                            <p className="text-xs text-pink-400 flex items-center gap-1"><Clock className="w-3 h-3"/> Activo</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 bg-black/40 p-2 rounded-lg truncate">
                          {conv.phone_number}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 2: Interesados */}
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl flex flex-col h-[35vh] md:h-[70vh]">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Interesados (Link de Pago)
                    </h3>
                    <span className="bg-white/10 text-xs px-2 py-1 rounded-full">{conversationsData?.interested?.length || 0}</span>
                  </div>
                  <div className="p-4 space-y-4 overflow-y-auto flex-1">
                    {(conversationsData?.interested || []).map((conv: any) => (
                      <div 
                        key={conv.id} 
                        onClick={() => setSelectedChat({id: conv.id, name: conv.customer_name, status: conv.status})}
                        className="bg-white/[0.03] p-4 rounded-xl border border-white/5 hover:border-yellow-500/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-yellow-300" />
                          </div>
                          <div>
                            <p className="text-sm font-medium truncate max-w-[120px]">{conv.customer_name}</p>
                            <p className="text-xs text-yellow-400">Generó Pago</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 bg-black/40 p-2 rounded-lg truncate">
                          {conv.phone_number}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 3: Compradores */}
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl flex flex-col h-[35vh] md:h-[70vh]">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Compraron
                    </h3>
                    <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-1 rounded-full">{conversationsData?.bought?.length || 0}</span>
                  </div>
                  <div className="p-4 space-y-4 overflow-y-auto flex-1">
                    {(conversationsData?.bought || []).map((conv: any) => (
                      <div 
                        key={conv.id} 
                        onClick={() => setSelectedChat({id: conv.id, name: conv.customer_name, status: conv.status})}
                        className="bg-white/[0.03] p-4 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-emerald-300" />
                          </div>
                          <div>
                            <p className="text-sm font-medium truncate max-w-[120px]">{conv.customer_name}</p>
                            <p className="text-xs text-emerald-400">Cliente Cerrado</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 bg-black/40 p-2 rounded-lg truncate">
                          {conv.phone_number}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              </motion.div>
            )}

            {/* ----------------- TAB: SETTINGS ----------------- */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                <form onSubmit={handleSaveSettings} className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 backdrop-blur-md relative overflow-hidden">
                  
                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

                  <div className="space-y-8 relative z-10">
                    
                    {/* ⚠️ Advertencia de APIs */}
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="text-amber-300 font-bold text-sm">⚠️ Zona Sensible — APIs del Chatbot</h4>
                        <p className="text-amber-400/70 text-xs mt-1 leading-relaxed">
                          Modificar las API Keys o el Prompt puede hacer que el chatbot de WhatsApp <strong className="text-amber-300">deje de funcionar</strong>. 
                          Solo cambia estos valores si estás seguro de lo que haces. Si tienes dudas, contacta al equipo técnico.
                        </p>
                      </div>
                    </div>

                    {/* WhatsApp Section */}
                    <div>
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
                        <MessageSquare className="w-5 h-5 text-green-400" />
                        Conexión WhatsApp
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">WhatsApp Business API Key</label>
                          <div className="relative">
                            <input 
                              type={showWhatsappKey ? "text" : "password"} 
                              value={configData.whatsapp_token || ''}
                              onChange={e => setConfigData({...configData, whatsapp_token: e.target.value})}
                              className="w-full bg-black/50 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-slate-800 placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono text-sm"
                              placeholder="Escribe tu API Key aquí..."
                            />
                            <button
                              type="button"
                              onClick={() => setShowWhatsappKey(!showWhatsappKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-800 transition-colors"
                            >
                              {showWhatsappKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Número de Teléfono (ID)</label>
                          <input 
                            type="text" 
                            value={configData.whatsapp_phone_id || ''}
                            onChange={e => setConfigData({...configData, whatsapp_phone_id: e.target.value})}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-slate-800 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* AI Section */}
                    <div>
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
                        <BrainCircuit className="w-5 h-5 text-blue-400" />
                        Cerebro de Inteligencia Artificial
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">OpenAI API Key (ChatGPT o Groq)</label>
                          <div className="relative">
                            <input 
                              type={showOpenAiKey ? "text" : "password"} 
                              value={configData.openai_key || ''}
                              onChange={e => setConfigData({...configData, openai_key: e.target.value})}
                              className="w-full bg-black/50 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-slate-800 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm"
                              placeholder="sk-..."
                            />
                            <button
                              type="button"
                              onClick={() => setShowOpenAiKey(!showOpenAiKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-800 transition-colors"
                            >
                              {showOpenAiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1 flex justify-between">
                            <span>Prompt del Vendedor (Instrucciones)</span>
                            <span className="text-purple-400 text-xs">El núcleo de tu IA</span>
                          </label>
                          <textarea 
                            rows={5}
                            value={configData.ai_prompt || ''}
                            onChange={e => setConfigData({...configData, ai_prompt: e.target.value})}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-slate-800 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all resize-y text-sm leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Webhook Section */}
                    <div>
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
                        <CreditCard className="w-5 h-5 text-yellow-400" />
                        Pasarela de Pago
                      </h3>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">URL del Webhook (Para recibir notificaciones de pago)</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            readOnly
                            value="https://rifx-marketing.com/api/webhooks/stripe"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-gray-400 cursor-not-allowed font-mono text-sm"
                          />
                          <button type="button" className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all text-sm font-medium">
                            Copiar
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Pega esta URL en tu cuenta de Stripe o MercadoPago para que la IA sepa cuando el cliente ha pagado.</p>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4 flex items-center gap-4">
                      <button 
                        type="submit" 
                        disabled={isSaving}
                        className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-slate-800 rounded-xl font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
                      >
                        {isSaving ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Save className="w-5 h-5" />
                        )}
                        {isSaving ? 'Guardando...' : 'Guardar Configuración'}
                      </button>

                      <AnimatePresence>
                        {showSuccess && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="flex items-center gap-2 text-emerald-400 text-sm font-medium"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            ¡Guardado con éxito!
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Error message */}
                    <AnimatePresence>
                      {saveError && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl"
                        >
                          <X className="w-5 h-5 shrink-0" />
                          <span><strong>Error al guardar:</strong> {saveError}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                </form>

                {/* 🔐 Cambiar Contraseña */}
                <form onSubmit={handleChangePassword} className="mt-6 bg-white/[0.02] border border-white/10 rounded-2xl p-8 backdrop-blur-md relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
                  
                  <div className="relative z-10">
                    <h3 className="text-xl font-semibold mb-2 flex items-center gap-2 border-b border-white/10 pb-2">
                      <Lock className="w-5 h-5 text-emerald-400" />
                      Cambiar Contraseña del Panel
                    </h3>
                    <p className="text-xs text-gray-500 mb-6">Cambia tu contraseña de acceso al dashboard de administración.</p>

                    <div className="space-y-4 max-w-md">
                      {/* Contraseña actual */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Contraseña Actual</label>
                        <div className="relative">
                          <input 
                            type={showCurrentPw ? "text" : "password"}
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-slate-800 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                            placeholder="Ingresa tu contraseña actual"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPw(!showCurrentPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-800 transition-colors"
                          >
                            {showCurrentPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Nueva contraseña */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Nueva Contraseña</label>
                        <div className="relative">
                          <input 
                            type={showNewPw ? "text" : "password"}
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-slate-800 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                            placeholder="Mínimo 6 caracteres"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPw(!showNewPw)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-800 transition-colors"
                          >
                            {showNewPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirmar contraseña */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Confirmar Nueva Contraseña</label>
                        <input 
                          type="password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-slate-800 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                          placeholder="Repite la nueva contraseña"
                        />
                      </div>

                      {/* Botón + Mensajes */}
                      <div className="pt-2 space-y-3">
                        <button 
                          type="submit"
                          disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-800 rounded-xl font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {changingPassword ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                          {changingPassword ? 'Cambiando...' : 'Cambiar Contraseña'}
                        </button>

                        <AnimatePresence>
                          {passwordSuccess && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl"
                            >
                              <CheckCircle2 className="w-5 h-5 shrink-0" />
                              <span>¡Contraseña actualizada correctamente! Usa la nueva contraseña en tu próximo inicio de sesión.</span>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <AnimatePresence>
                          {passwordError && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl"
                            >
                              <X className="w-5 h-5 shrink-0" />
                              <span>{passwordError}</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </form>

              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat modal rendered via portal to document.body - see bottom of component */}

          {/* ----------------- CHART MODAL ----------------- */}


          {/* ----------------- CHART MODAL ----------------- */}
          <AnimatePresence>
            {showChartModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  className="bg-white border border-white/10 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6"
                >
                  {/* Header */}
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                         <TrendingUp className="text-emerald-400 w-6 h-6"/> Ingresos Generados
                      </h3>
                      <p className="text-gray-400 text-sm mt-1">Navega por el calendario y observa tu rendimiento diario</p>
                    </div>
                    <button 
                      onClick={() => setShowChartModal(false)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-6">
                    {/* ---- Mini Calendar ---- */}
                    <div className="bg-black/40 border border-white/10 rounded-xl p-4 md:w-64 shrink-0">
                      {/* Month Navigation */}
                      <div className="flex items-center justify-between mb-4">
                        <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else { setCalMonth(calMonth - 1); } setSelectedDay(null); }} className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-slate-800">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <span className="text-sm font-bold text-slate-800">{MONTH_NAMES[calMonth]} {calYear}</span>
                        <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else { setCalMonth(calMonth + 1); } setSelectedDay(null); }} className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-slate-800">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {DAY_LABELS.map(d => <span key={d} className="text-center text-[10px] text-gray-500 font-bold uppercase">{d}</span>)}
                      </div>
                      {/* Day cells */}
                      <div className="grid grid-cols-7 gap-1">
                        {(() => {
                          const totalDays = getDaysInMonth(calYear, calMonth);
                          const firstDay = getFirstDayOfWeek(calYear, calMonth);
                          const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
                          const monthData = monthlyIncomeData[key] || {};
                          const cells = [];
                          for (let i = 0; i < firstDay; i++) {
                            cells.push(<div key={`empty-${i}`} />);
                          }
                          for (let day = 1; day <= totalDays; day++) {
                            const hasData = monthData[day] !== undefined;
                            const isSelected = selectedDay === day;
                            cells.push(
                              <button
                                key={day}
                                onClick={() => setSelectedDay(isSelected ? null : day)}
                                className={`w-full aspect-square rounded-md text-xs font-medium flex items-center justify-center transition-all
                                  ${isSelected 
                                    ? 'bg-purple-500 text-slate-800 shadow-[0_0_10px_rgba(168,85,247,0.5)]' 
                                    : hasData 
                                      ? 'bg-white/5 text-gray-300 hover:bg-purple-500/20 hover:text-slate-800' 
                                      : 'text-gray-600 cursor-default'
                                  }`}
                              >
                                {day}
                              </button>
                            );
                          }
                          return cells;
                        })()}
                      </div>
                      {/* Selected day detail */}
                      {selectedDay && (() => {
                        const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
                        const amount = (monthlyIncomeData[key] || {})[selectedDay];
                        return (
                          <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                            <p className="text-xs text-gray-400">{selectedDay} {MONTH_NAMES[calMonth]} {calYear}</p>
                            <p className="text-xl font-bold text-slate-800 mt-1">${amount ?? 0}</p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* ---- Line Chart ---- */}
                    <div className="flex-1 flex flex-col">
                      {(() => {
                        const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
                        const monthData = monthlyIncomeData[key] || {};
                        const totalDays = getDaysInMonth(calYear, calMonth);
                        const values = Array.from({ length: totalDays }, (_, i) => monthData[i + 1] ?? 0);
                        const maxVal = Math.max(...values, 1);
                        const totalIncome = values.reduce((a, b) => a + b, 0);
                        const chartW = 500;
                        const chartH = 200;
                        const padX = 30;
                        const padY = 20;
                        const innerW = chartW - padX * 2;
                        const innerH = chartH - padY * 2;

                        const points = values.map((v, i) => {
                          const x = padX + (i / (values.length - 1)) * innerW;
                          const y = padY + innerH - (v / maxVal) * innerH;
                          return { x, y, val: v, day: i + 1 };
                        });

                        const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                        const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartH - padY} L ${points[0].x} ${chartH - padY} Z`;

                        return (
                          <>
                            <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-48 md:h-56">
                              <defs>
                                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="rgba(168,85,247,0.4)" />
                                  <stop offset="100%" stopColor="rgba(168,85,247,0)" />
                                </linearGradient>
                                <linearGradient id="strokeGrad" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#a855f7" />
                                  <stop offset="100%" stopColor="#6366f1" />
                                </linearGradient>
                              </defs>
                              {/* Grid lines */}
                              {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                                const y = padY + innerH - pct * innerH;
                                return <line key={pct} x1={padX} y1={y} x2={chartW - padX} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
                              })}
                              {/* Y-axis labels */}
                              {[0, 0.5, 1].map(pct => {
                                const y = padY + innerH - pct * innerH;
                                return <text key={`lbl-${pct}`} x={padX - 4} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="9">${Math.round(maxVal * pct)}</text>;
                              })}
                              {/* Gradient fill */}
                              <path d={areaPath} fill="url(#lineGrad)" />
                              {/* Line */}
                              <path d={linePath} fill="none" stroke="url(#strokeGrad)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                              {/* Dots */}
                              {points.map((p) => (
                                <g key={p.day}>
                                  <circle cx={p.x} cy={p.y} r={selectedDay === p.day ? 5 : 3} fill={selectedDay === p.day ? '#a855f7' : '#6366f1'} stroke={selectedDay === p.day ? '#fff' : 'none'} strokeWidth={selectedDay === p.day ? 2 : 0} className="cursor-pointer" onClick={() => setSelectedDay(selectedDay === p.day ? null : p.day)} />
                                  {selectedDay === p.day && (
                                    <>
                                      <line x1={p.x} y1={p.y + 6} x2={p.x} y2={chartH - padY} stroke="rgba(168,85,247,0.3)" strokeWidth="1" strokeDasharray="4 2" />
                                      <rect x={p.x - 22} y={p.y - 24} width="44" height="18" rx="4" fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.3)" strokeWidth="0.5" />
                                      <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#34d399" fontSize="10" fontWeight="bold">${p.val}</text>
                                    </>
                                  )}
                                </g>
                              ))}
                              {/* X labels (show some) */}
                              {points.filter((_, i) => i % Math.ceil(totalDays / 8) === 0 || i === totalDays - 1).map(p => (
                                <text key={`x-${p.day}`} x={p.x} y={chartH - 4} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9">{p.day}</text>
                              ))}
                            </svg>
                            <div className="pt-4 flex justify-between items-center border-t border-white/10 mt-2">
                              <p className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">Total del Mes</span>
                                <span className="font-bold text-2xl text-white">${totalIncome.toLocaleString()}</span>
                              </p>
                              <p className="flex flex-col text-right">
                                <span className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">Promedio Diario</span>
                                <span className="font-bold text-xl text-emerald-400">${Math.round(totalIncome / totalDays)}</span>
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>
    </div>

    {/* ----------------- CHAT MODAL (Portal to body) ----------------- */}
    {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {selectedChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center md:p-4 bg-black/80 backdrop-blur-sm"
            style={{ isolation: 'isolate' }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full md:max-w-lg md:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[100dvh] md:h-[600px] md:border md:border-white/10"
            >
              {/* Header */}
              <div className="p-3 md:p-4 border-b border-white/10 flex justify-between items-center bg-white safe-area-top shrink-0">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  {/* Mobile back arrow */}
                  <button 
                    onClick={() => setSelectedChat(null)}
                    className="md:hidden p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 ${isHumanMode ? 'bg-gradient-to-tr from-orange-500 to-amber-500' : 'bg-gradient-to-tr from-purple-600 to-blue-600'}`}>
                    <User className="w-4 h-4 md:w-5 md:h-5 text-slate-800" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 text-sm md:text-base truncate">{selectedChat.name}</h3>
                    <p className={`text-[10px] md:text-xs flex items-center gap-1 ${isHumanMode ? 'text-orange-400' : 'text-emerald-400'}`}>
                      <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full animate-pulse ${isHumanMode ? 'bg-orange-400' : 'bg-emerald-400'}`}></span>
                      <span className="truncate">{isHumanMode ? '👤 Modo Humano (IA pausada)' : '🤖 IA respondiendo'}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                  <button
                    onClick={async () => {
                      const newPaused = !isHumanMode;
                      const resPatch = await fetch('/api/panel/pause', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ conversationId: selectedChat!.id, paused: newPaused }),
                      });
                      if (resPatch.ok) {
                        setIsHumanMode(newPaused);
                      } else {
                        const errData = await resPatch.json();
                        alert(`Error al cambiar modo: ${errData.error}`);
                      }
                    }}
                    className={`px-2.5 md:px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-medium transition-all whitespace-nowrap ${
                      isHumanMode
                        ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                        : 'bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30'
                    }`}
                  >
                    {isHumanMode ? '🤖 Devolver a IA' : '👤 Tomar Control'}
                  </button>
                  <button 
                    onClick={() => setSelectedChat(null)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-black/20" ref={chatContainerRef}>
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                      <p className="text-sm text-gray-500">Cargando mensajes...</p>
                    </div>
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-gray-500">No hay mensajes aún</p>
                  </div>
                ) : (
                  chatMessages.map((msg: any, idx: number) => {
                    const time = new Date(msg.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
                    const isUser = msg.role === 'user';
                    const msgDate = new Date(msg.created_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
                    const prevDate = idx > 0 ? new Date(chatMessages[idx-1].created_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }) : null;
                    const showDate = idx === 0 || msgDate !== prevDate;
                    return (
                      <React.Fragment key={msg.id || idx}>
                        {showDate && (
                          <p className="text-xs text-center text-gray-600 my-3 select-none">{msgDate}</p>
                        )}
                        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-3 rounded-2xl max-w-[80%] text-sm whitespace-pre-wrap ${
                            isUser
                              ? 'bg-purple-600/20 border border-purple-500/30 text-slate-800 rounded-tr-sm'
                              : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm'
                          }`}>
                            {msg.content}
                            <p className={`text-[10px] mt-1 ${isUser ? 'text-purple-400/60 text-right' : 'text-gray-600'}`}>
                              {time} {!isUser && '• IA'}
                            </p>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div className="flex items-center gap-2 pt-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-xs text-gray-500">Actualizando en vivo cada 5s</p>
                </div>
              </div>

              {/* Status Change Buttons */}
              <div className="px-3 md:px-4 pt-2 md:pt-3 pb-1 border-t border-white/10 bg-white shrink-0">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 md:mb-2">Mover a:</p>
                <div className="flex gap-1.5 md:gap-2">
                  {!selectedChat.status.includes('chatting') && (
                    <button
                      onClick={async () => {
                        await fetch('/api/panel/conversations', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: selectedChat!.id, status: 'chatting' }),
                        });
                        setSelectedChat({ ...selectedChat!, status: 'chatting' });
                        const res = await fetch('/api/panel/conversations');
                        const data = await res.json();
                        setConversationsData(data);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-pink-500/10 border border-pink-500/20 hover:bg-pink-500/20 transition-colors text-pink-400 text-xs font-medium"
                    >
                      <MessageSquare className="w-3 h-3" /> Chateando
                    </button>
                  )}
                  {!selectedChat.status.includes('interested') && (
                    <button
                      onClick={async () => {
                        await fetch('/api/panel/conversations', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: selectedChat!.id, status: 'interested' }),
                        });
                        setSelectedChat({ ...selectedChat!, status: 'interested' });
                        const res = await fetch('/api/panel/conversations');
                        const data = await res.json();
                        setConversationsData(data);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors text-yellow-400 text-xs font-medium"
                    >
                      <Zap className="w-3 h-3" /> Interesado
                    </button>
                  )}
                  {!selectedChat.status.includes('bought') && (
                    <button
                      onClick={async () => {
                        await fetch('/api/panel/conversations', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: selectedChat!.id, status: 'bought' }),
                        });
                        setSelectedChat({ ...selectedChat!, status: 'bought' });
                        const res = await fetch('/api/panel/conversations');
                        const data = await res.json();
                        setConversationsData(data);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors text-emerald-400 text-xs font-medium"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Compró
                    </button>
                  )}
                </div>
              </div>

              {/* Input area */}
              <div className="p-3 md:p-4 border-t border-white/5 bg-white flex gap-2 items-center safe-area-bottom shrink-0">
                {isHumanMode ? (
                  <>
                    <input 
                      type="text" 
                      value={manualMsg}
                      onChange={(e) => setManualMsg(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && manualMsg.trim() && !sendingMsg) {
                          setSendingMsg(true);
                          await fetch('/api/panel/send-message', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ conversationId: selectedChat!.id, message: manualMsg.trim() }),
                          });
                          setManualMsg('');
                          const res = await fetch(`/api/panel/conversations?id=${selectedChat!.id}`);
                          const data = await res.json();
                          if (data.messages) setChatMessages(data.messages);
                          setSendingMsg(false);
                        }
                      }}
                      placeholder="Escribe tu mensaje..." 
                      className="flex-1 bg-black/50 border border-orange-500/30 rounded-xl px-4 py-2 text-sm text-slate-800 placeholder-gray-500 focus:border-orange-500/60 focus:outline-none"
                      disabled={sendingMsg}
                    />
                    <button
                      onClick={async () => {
                        if (!manualMsg.trim() || sendingMsg) return;
                        setSendingMsg(true);
                        await fetch('/api/panel/send-message', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ conversationId: selectedChat!.id, message: manualMsg.trim() }),
                        });
                        setManualMsg('');
                        const res = await fetch(`/api/panel/conversations?id=${selectedChat!.id}`);
                        const data = await res.json();
                        if (data.messages) setChatMessages(data.messages);
                        setSendingMsg(false);
                      }}
                      disabled={sendingMsg || !manualMsg.trim()}
                      className="w-10 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {sendingMsg ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4 text-slate-800" />
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <input 
                      type="text" 
                      placeholder="La IA está respondiendo... (clic 'Tomar Control' para escribir)" 
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
                      readOnly
                    />
                    <div className="w-10 h-10 rounded-xl bg-purple-600/50 flex items-center justify-center opacity-50 cursor-not-allowed">
                      <Zap className="w-4 h-4 text-slate-800" />
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}

    </>
  );
}
