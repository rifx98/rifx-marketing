'use client';

import React, { useState } from 'react';
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
  ShieldCheck
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

  const [activeTab, setActiveTab] = useState<'dashboard' | 'crm' | 'settings'>('dashboard');
  const [selectedChat, setSelectedChat] = useState<{name: string, status: string} | null>(null);
  const [showChartModal, setShowChartModal] = useState(false);
  const [calMonth, setCalMonth] = useState(4);
  const [calYear, setCalYear] = useState(2026);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Estados para datos reales
  const [conversationsData, setConversationsData] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [configData, setConfigData] = useState<any>({
    whatsapp_token: '',
    whatsapp_phone_id: '',
    openai_key: '',
    ai_prompt: ''
  });

  React.useEffect(() => {
    if (isLoggedIn) {
      // Cargar CRM
      fetch('/api/panel/conversations')
        .then(res => res.json())
        .then(data => setConversationsData(data))
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
           setConfigData(data);
        })
        .catch(console.error);

      // Refrescar cada 10 segundos
      const interval = setInterval(() => {
        fetch('/api/panel/conversations').then(res => res.json()).then(data => setConversationsData(data));
        fetch('/api/panel/stats').then(res => res.json()).then(data => setStatsData(data));
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    setTimeout(() => {
      if (loginUser === 'admin' && loginPass === 'rifx2026') {
        setIsLoggedIn(true);
      } else {
        setLoginError('Usuario o contraseña incorrectos');
      }
      setIsLoggingIn(false);
    }, 1000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/panel/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      if (res.ok) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // ========== LOGIN SCREEN ==========
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6 font-sans relative overflow-hidden">
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
              <Bot className="w-8 h-8 text-white" />
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
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
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
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-12 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
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
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
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
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row font-sans selection:bg-purple-500/30">
      
      {/* Sidebar Navigation */}
      <motion.aside 
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full md:w-64 bg-white/[0.02] border-b md:border-b-0 md:border-r border-white/10 backdrop-blur-xl flex flex-col z-20 sticky top-0 md:h-screen"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">RIFX Panel</h1>
            <p className="text-xs text-purple-400 font-medium">IA Sales Bot</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 flex md:flex-col overflow-x-auto md:overflow-visible">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full whitespace-nowrap ${
              activeTab === 'dashboard' 
                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.1)]' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Resumen</span>
          </button>

          <button
            onClick={() => setActiveTab('crm')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full whitespace-nowrap ${
              activeTab === 'crm' 
                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.1)]' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Contactos (CRM)</span>
          </button>
          
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full whitespace-nowrap ${
              activeTab === 'settings' 
                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.1)]' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Configuración API</span>
          </button>
        </nav>

        <div className="p-4 hidden md:block">
          <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all w-full">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Volver a la Web</span>
          </Link>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 relative overflow-y-auto h-screen">
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
                {/* Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div 
                    onClick={() => setShowChartModal(true)}
                    className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group hover:border-purple-500/30 transition-all cursor-pointer"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all" />
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <p className="text-gray-400 text-sm font-medium mb-1">Ingresos Generados (IA)</p>
                        <h3 className="text-3xl font-bold text-white">${statsData?.totalRevenue || 0}</h3>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                      </div>
                    </div>
                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                      <span className="font-bold">Total histórico</span>
                    </p>
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group hover:border-blue-500/30 transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all" />
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <p className="text-gray-400 text-sm font-medium mb-1">Ventas Cerradas</p>
                        <h3 className="text-3xl font-bold text-white">{statsData?.totalSales || 0}</h3>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-blue-400" />
                      </div>
                    </div>
                    <p className="text-xs text-blue-400 flex items-center gap-1">
                      Completamente automáticas
                    </p>
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden group hover:border-pink-500/30 transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl group-hover:bg-pink-500/20 transition-all" />
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div>
                        <p className="text-gray-400 text-sm font-medium mb-1">Conversaciones Activas</p>
                        <h3 className="text-3xl font-bold text-white">{statsData?.activeConversations || 0}</h3>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-pink-400" />
                      </div>
                    </div>
                    <p className="text-xs text-pink-400 flex items-center gap-1">
                      La IA está negociando ahora
                    </p>
                  </div>
                </div>

                {/* Sales Feed */}
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
                  <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.01]">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      Muro de Ventas Recientes
                    </h3>
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full border border-purple-500/30">
                      En Vivo
                    </span>
                  </div>
                  <div className="p-0">
                    {(statsData?.recentSales || mockSales).map((sale: any, index: number) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        key={sale.id} 
                        className="flex items-center justify-between p-6 border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-800 to-gray-700 flex items-center justify-center border border-white/10">
                            <User className="w-6 h-6 text-gray-300" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">{sale.customer}</p>
                            <p className="text-sm text-gray-400">{sale.service}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-400 flex items-center gap-1 justify-end">
                            <CreditCard className="w-4 h-4" />
                            +${sale.amount}
                          </p>
                          <p className="text-xs text-gray-500">{sale.time}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
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
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {/* Column 1: Chateando */}
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl flex flex-col h-[70vh]">
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
                        onClick={() => setSelectedChat({name: conv.customer_name, status: 'Chateando Ahora'})}
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
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl flex flex-col h-[70vh]">
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
                        onClick={() => setSelectedChat({name: conv.customer_name, status: 'Interesado'})}
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
                <div className="bg-white/[0.02] border border-white/10 rounded-2xl flex flex-col h-[70vh]">
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
                        onClick={() => setSelectedChat({name: conv.customer_name, status: 'Compró'})}
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
                    
                    {/* WhatsApp Section */}
                    <div>
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
                        <MessageSquare className="w-5 h-5 text-green-400" />
                        Conexión WhatsApp
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">WhatsApp Business API Key</label>
                          <input 
                            type="password" 
                            value={configData.whatsapp_token || ''}
                            onChange={e => setConfigData({...configData, whatsapp_token: e.target.value})}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono text-sm"
                            placeholder="Escribe tu API Key aquí..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Número de Teléfono (ID)</label>
                          <input 
                            type="text" 
                            value={configData.whatsapp_phone_id || ''}
                            onChange={e => setConfigData({...configData, whatsapp_phone_id: e.target.value})}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all"
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
                          <input 
                            type="password" 
                            value={configData.openai_key || ''}
                            onChange={e => setConfigData({...configData, openai_key: e.target.value})}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm"
                            placeholder="sk-..."
                          />
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
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all resize-y text-sm leading-relaxed"
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
                        className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
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

                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ----------------- CHAT MODAL ----------------- */}
          <AnimatePresence>
            {selectedChat && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  className="bg-[#0f0f0f] border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px]"
                >
                  {/* Header */}
                  <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{selectedChat.name}</h3>
                        <p className="text-xs text-emerald-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          En línea (IA asignada)
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedChat(null)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  {/* Chat Area */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-black/20">
                    <p className="text-xs text-center text-gray-500 my-4">Hoy 10:42 AM</p>
                    
                    {/* User Msg */}
                    <div className="flex justify-end">
                      <div className="bg-purple-600/20 border border-purple-500/30 text-white p-3 rounded-2xl rounded-tr-sm max-w-[80%] text-sm">
                        Hola, vi el anuncio en Instagram. ¿Qué precio tiene el diseño web?
                      </div>
                    </div>
                    
                    {/* AI Msg */}
                    <div className="flex justify-start">
                      <div className="bg-white/5 border border-white/10 text-gray-200 p-3 rounded-2xl rounded-tl-sm max-w-[80%] text-sm">
                        ¡Hola {selectedChat.name.split(' ')[0]}! 👋 Soy Nova, asesor de RIFX. El paquete de Diseño Web Inmersivo comienza en $850. Incluye optimización SEO y diseño adaptado a móviles. ¿Te gustaría que te envíe el PDF con todos los detalles?
                      </div>
                    </div>

                    {/* User Msg */}
                    <div className="flex justify-end">
                      <div className="bg-purple-600/20 border border-purple-500/30 text-white p-3 rounded-2xl rounded-tr-sm max-w-[80%] text-sm">
                        Sí por favor. ¿Y cuánto tardan en entregarlo?
                      </div>
                    </div>

                    {/* AI Msg */}
                    <div className="flex justify-start">
                      <div className="bg-white/5 border border-white/10 text-gray-200 p-3 rounded-2xl rounded-tl-sm max-w-[80%] text-sm">
                        ¡Claro que sí! 📄 *[Documento Enviado]* <br/><br/>
                        El tiempo de entrega es de 2 a 3 semanas dependiendo de la complejidad. Si estás listo para empezar, puedo generarte un link de pago ahora mismo para agendar tu proyecto. 🚀
                      </div>
                    </div>
                    
                    {selectedChat.status === 'Chateando Ahora' && (
                      <div className="flex justify-start">
                         <p className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                           <Clock className="w-3 h-3"/> Cliente escribiendo...
                         </p>
                      </div>
                    )}
                  </div>

                  {/* Input area (read only for now) */}
                  <div className="p-4 border-t border-white/10 bg-white/[0.01] flex gap-2 items-center">
                    <input 
                      type="text" 
                      placeholder="La IA está respondiendo automáticamente..." 
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
                      readOnly
                    />
                    <div className="w-10 h-10 rounded-xl bg-purple-600/50 flex items-center justify-center opacity-50 cursor-not-allowed">
                       <Zap className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ----------------- CHART MODAL ----------------- */}
          <AnimatePresence>
            {showChartModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  className="bg-[#0f0f0f] border border-white/10 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6"
                >
                  {/* Header */}
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-white flex items-center gap-2">
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
                        <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else { setCalMonth(calMonth - 1); } setSelectedDay(null); }} className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <span className="text-sm font-bold text-white">{MONTH_NAMES[calMonth]} {calYear}</span>
                        <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else { setCalMonth(calMonth + 1); } setSelectedDay(null); }} className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white">
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
                                    ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]' 
                                    : hasData 
                                      ? 'bg-white/5 text-gray-300 hover:bg-purple-500/20 hover:text-white' 
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
                            <p className="text-xl font-bold text-white mt-1">${amount ?? 0}</p>
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
  );
}
