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
import Script from 'next/script';

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
  const [loginUser, setLoginUser] = useState(''); // now used as email
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerCompany, setRegisterCompany] = useState('');
  const [registerOwner, setRegisterOwner] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [tenantData, setTenantData] = useState<any>(null);
  
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
  const [botKnowledgeFiles, setBotKnowledgeFiles] = useState<{id?: string, name: string, type: string, size: string, active: boolean}[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbUploading, setKbUploading] = useState(false);
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
        if (cfg.botModelSelected) setBotModelSelected(cfg.botModelSelected);
        if (cfg.botHumanHandoff !== undefined) setBotHumanHandoff(cfg.botHumanHandoff);
        if (cfg.botProfanityFilter !== undefined) setBotProfanityFilter(cfg.botProfanityFilter);
        if (cfg.botTopicLocks !== undefined) setBotTopicLocks(cfg.botTopicLocks);
      }
    } catch {}
  }, []);

  // Auto-save playground config whenever any setting changes
  const playgroundLoaded = React.useRef(false);
  React.useEffect(() => {
    // Skip the first render (initial state, before localStorage is loaded)
    if (!playgroundLoaded.current) {
      playgroundLoaded.current = true;
      return;
    }
    try {
      const playgroundConfig = { botName, botRole, botTone, botTemperature, botModelSelected, botHumanHandoff, botProfanityFilter, botTopicLocks };
      localStorage.setItem('rifx_playground_config', JSON.stringify(playgroundConfig));
      console.log('Playground config auto-guardado:', playgroundConfig.botModelSelected);
    } catch (e) { console.error('Error auto-saving playground config:', e); }
  }, [botName, botRole, botTone, botTemperature, botModelSelected, botHumanHandoff, botProfanityFilter, botTopicLocks]);

  // === Knowledge Base Management Functions ===
  const fetchKBFiles = React.useCallback(async () => {
    setKbLoading(true);
    try {
      const res = await authFetch('/api/panel/knowledge');
      const data = await res.json();
      if (data.files) {
        setBotKnowledgeFiles(data.files.map((f: any) => ({
          id: f.id, name: f.file_name, type: f.file_type, size: f.file_size, active: f.active,
        })));
      }
    } catch (e) { console.error('Error fetching KB files:', e); }
    setKbLoading(false);
  }, []);

  const uploadKBFile = async (file: File) => {
    setKbUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch('/api/panel/knowledge', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        await fetchKBFiles(); // Reload the list
        console.log(`KB subido: ${file.name} (${data.extractedChars} chars extraídos)`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) { console.error('Error uploading KB file:', e); alert('Error al subir archivo'); }
    setKbUploading(false);
  };

  const toggleKBFile = async (id: string, active: boolean) => {
    try {
      setBotKnowledgeFiles(prev => prev.map(f => f.id === id ? { ...f, active } : f));
      await authFetch('/api/panel/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active }),
      });
    } catch (e) { console.error('Error toggling KB file:', e); }
  };

  const deleteKBFile = async (id: string) => {
    try {
      setBotKnowledgeFiles(prev => prev.filter(f => f.id !== id));
      await authFetch('/api/panel/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (e) { console.error('Error deleting KB file:', e); }
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'crm' | 'settings' | 'playground' | 'segments' | 'analytics' | 'billing' | 'admin' | 'campaigns'>('dashboard');

  // Load KB files when playground tab opens
  const kbLoadedRef = React.useRef(false);
  React.useEffect(() => {
    if (activeTab === 'playground' && isLoggedIn && !kbLoadedRef.current) {
      kbLoadedRef.current = true;
      fetchKBFiles();
    }
  }, [activeTab, isLoggedIn, fetchKBFiles]);
  const [currentPlan, setCurrentPlan] = useState<'trial' | 'start' | 'advanced' | 'plus' | 'master'>('trial');
  const [planExpiry, setPlanExpiry] = useState<string>('');
  const [subscriptionData, setSubscriptionData] = useState<any[]>([]);
  const [showPlanConfirm, setShowPlanConfirm] = useState<string | null>(null);

  // Campaigns State
  const [campaignDesc, setCampaignDesc] = useState('');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignImage, setCampaignImage] = useState<File | null>(null);
  const [campaignImagePreview, setCampaignImagePreview] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [dailyBudget, setDailyBudget] = useState(5);
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false);
  const [campaignResult, setCampaignResult] = useState<any>(null);
  const campaignFileRef = React.useRef<HTMLInputElement>(null);
  const productFileRef = React.useRef<HTMLInputElement>(null);
  const [campaignSubTab, setCampaignSubTab] = useState<'campaigns' | 'creative' | 'analytics'>('creative');

  // === Facebook Marketing API ===
  const [fbCampaigns, setFbCampaigns] = useState<any[]>([]);
  const [fbInsights, setFbInsights] = useState<any>(null);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbError, setFbError] = useState<string | null>(null);
  const loadFbCampaigns = async () => { setFbLoading(true); setFbError(null); try { const r = await fetch('/api/panel/facebook/campaigns?date_preset=last_30d'); const d = await r.json(); if(d.success) setFbCampaigns(d.campaigns||[]); else setFbError(d.error||'Error'); } catch(e:any){setFbError(e.message)} finally{setFbLoading(false)} };
  const loadFbInsights = async () => { setFbLoading(true); setFbError(null); try { const r = await fetch('/api/panel/facebook/insights?date_preset=last_30d'); const d = await r.json(); if(d.success) setFbInsights(d); else setFbError(d.error||'Error'); } catch(e:any){setFbError(e.message)} finally{setFbLoading(false)} };
  const toggleFbCampaign = async (id:string, status:string) => { const s = status==='ACTIVE'?'PAUSED':'ACTIVE'; try { const r = await fetch('/api/panel/facebook/campaigns',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({campaign_id:id,status:s})}); const d = await r.json(); if(d.success) loadFbCampaigns(); else alert(d.error); } catch(e:any){alert(e.message)} };
  const deleteFbCampaign = async (id:string) => { if(!confirm('Eliminar esta campaña?')) return; try { const r = await fetch('/api/panel/facebook/campaigns?campaign_id='+id,{method:'DELETE'}); const d = await r.json(); if(d.success) loadFbCampaigns(); else alert(d.error); } catch(e:any){alert(e.message)} };
  const [fbPublishing, setFbPublishing] = useState(false);
  const publishToFacebook = async () => {
    if (!campaignResult && !campaignDesc) { alert(language === 'en' ? 'First generate content with AI' : 'Primero genera contenido con IA'); return; }
    setFbPublishing(true);
    try {
      const caption = campaignResult?.caption || campaignDesc;
      const cfg = campaignResult?.campaign_config || {};
      const aud = campaignResult?.target_audience || {};
      const r = await fetch('/api/panel/facebook/publish', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          campaign_name: (campaignResult?.hook || caption).substring(0, 50),
          message: caption + (campaignResult?.hashtags ? '\n' + campaignResult.hashtags : ''),
          daily_budget: dailyBudget * 100,
          objective: cfg.objective || 'OUTCOME_TRAFFIC',
          link_url: 'https://rifx.online',
          countries: ['EC'],
          age_min: aud.age_min || 18,
          age_max: aud.age_max || 55,
          call_to_action: cfg.call_to_action || 'LEARN_MORE',
          status: 'PAUSED'
        })
      });
      const d = await r.json();
      if (d.success) {
        alert(language === 'en' ? 'Campaign published to Facebook! (Status: PAUSED)' : '\u00a1Campa\u00f1a publicada en Facebook! (Estado: PAUSADA)');
        loadFbCampaigns();
        setCampaignSubTab('campaigns');
      } else { alert('Error: ' + (d.error || 'Error desconocido')); }
    } catch(e:any) { alert('Error: ' + e.message); }
    finally { setFbPublishing(false); }
  };


  const handleGenerateCampaign = async () => {
    if (!campaignDesc && !campaignTitle) return;
    setIsGeneratingCampaign(true);
    setCampaignResult(null);
    try {
      const res = await authFetch('/api/panel/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: campaignDesc, title: campaignTitle, daily_budget: dailyBudget, has_reference_image: !!campaignImagePreview, has_product_image: !!productImagePreview })
      });
      const data = await res.json();
      if (data.success) {
        setCampaignResult(data.campaign);
        // Auto-generar banner con la imagen del producto
        setTimeout(() => generateBannerImage(data.campaign), 100);
      } else {
        alert(data.error || 'Error generating campaign');
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to server');
    } finally {
      setIsGeneratingCampaign(false);
    }
  };

  const handleCampaignImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCampaignImage(file);
      const url = URL.createObjectURL(file);
      setCampaignImagePreview(url);
    }
  };
  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProductImage(file);
      const url = URL.createObjectURL(file);
      setProductImagePreview(url);
    }
  };

  // Banner Generator con IA (Pollinations AI + Canvas overlay)
  const [generatedBanner, setGeneratedBanner] = useState<string | null>(null);
  const [isGeneratingBanner, setIsGeneratingBanner] = useState(false);

  const generateBannerImage = async (result: any) => {
    setIsGeneratingBanner(true);
    setGeneratedBanner(null);

    try {
      // Build an image generation prompt from the campaign data
      const product = campaignTitle || campaignDesc || 'marketing digital';
      const style = 'professional advertising banner, high-end commercial photography, studio lighting, clean modern design, premium brand aesthetic, 4k quality';
      const imgPrompt = `${product}, ${style}, no text, no letters, no words, no watermark`;
      const encodedPrompt = encodeURIComponent(imgPrompt);
      const aiImageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1080&seed=${Date.now()}&nologo=true&model=flux`;

      // Load the AI-generated image via fetch to avoid CORS
      const response = await fetch(aiImageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const aiImg = new Image();
      await new Promise<void>((resolve, reject) => {
        aiImg.onload = () => resolve();
        aiImg.onerror = () => reject(new Error('AI image failed'));
        aiImg.src = blobUrl;
      });

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;

      // Draw AI-generated background
      ctx.drawImage(aiImg, 0, 0, 1080, 1080);
      URL.revokeObjectURL(blobUrl);

      // If user uploaded a product image, composite it on the right side
      if (productImagePreview) {
        try {
          const prodImg = new Image();
          prodImg.crossOrigin = 'anonymous';
          await new Promise<void>((res, rej) => { prodImg.onload = () => res(); prodImg.onerror = rej; prodImg.src = productImagePreview; });
          // Draw product on right side with shadow
          const pSize = 420;
          const px = 620;
          const py = 340;
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 40;
          ctx.shadowOffsetX = 10;
          ctx.shadowOffsetY = 10;
          ctx.beginPath();
          ctx.roundRect(px, py, pSize, pSize, 20);
          ctx.clip();
          const pScale = Math.max(pSize / prodImg.width, pSize / prodImg.height);
          const pw = prodImg.width * pScale;
          const ph = prodImg.height * pScale;
          ctx.drawImage(prodImg, px + (pSize - pw)/2, py + (pSize - ph)/2, pw, ph);
          ctx.restore();
          // White border
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(px, py, pSize, pSize, 20);
          ctx.stroke();
        } catch(e) { /* product image optional */ }
      }

      // Gradient overlay for text readability (left side)
      const overlay = ctx.createLinearGradient(0, 0, 700, 0);
      overlay.addColorStop(0, 'rgba(0,0,0,0.75)');
      overlay.addColorStop(0.6, 'rgba(0,0,0,0.4)');
      overlay.addColorStop(1, 'rgba(0,0,0,0.05)');
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, 1080, 1080);

      // Bottom gradient
      const bottomGrad = ctx.createLinearGradient(0, 800, 0, 1080);
      bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
      bottomGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, 800, 1080, 280);

      // Top accent bar
      const accentGrad = ctx.createLinearGradient(0, 0, 300, 0);
      accentGrad.addColorStop(0, '#0058bc');
      accentGrad.addColorStop(1, 'rgba(0,88,188,0)');
      ctx.fillStyle = accentGrad;
      ctx.fillRect(0, 0, 1080, 6);

      // Framework badge
      ctx.fillStyle = 'rgba(0,88,188,0.9)';
      ctx.beginPath();
      ctx.roundRect(50, 50, 180, 34, 17);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Inter, system-ui, sans-serif';
      ctx.fillText('\u26a1 ' + (result?.copy_framework || 'RIFX AdGenius'), 70, 72);

      // Hook text with text shadow
      const hook = result?.hook || campaignTitle || 'Tu Producto';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 58px Inter, system-ui, sans-serif';
      const words = hook.split(' ');
      let line = '';
      let y = 180;
      const maxW = productImagePreview ? 550 : 900;
      for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line.trim(), 50, y);
          line = word + ' ';
          y += 68;
        } else { line = test; }
      }
      ctx.fillText(line.trim(), 50, y);

      // Caption excerpt
      ctx.shadowBlur = 8;
      const caption = (result?.caption || campaignDesc || '').substring(0, 100);
      if (caption) {
        ctx.font = '24px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        const cWords = caption.split(' ');
        let cLine = '';
        let cY = y + 55;
        for (const w of cWords) {
          const t = cLine + w + ' ';
          if (ctx.measureText(t).width > maxW && cLine) {
            ctx.fillText(cLine.trim(), 50, cY);
            cLine = w + ' ';
            cY += 32;
            if (cY > 600) break;
          } else { cLine = t; }
        }
        ctx.fillText(cLine.trim(), 50, cY);
      }

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // CTA Button
      const ctaLabel = result?.campaign_config?.call_to_action?.replace(/_/g, ' ') || 'MAS INFO';
      const ctaGrad = ctx.createLinearGradient(50, 920, 310, 980);
      ctaGrad.addColorStop(0, '#0058bc');
      ctaGrad.addColorStop(1, '#1877F2');
      ctx.fillStyle = ctaGrad;
      ctx.beginPath();
      ctx.roundRect(50, 930, 260, 56, 28);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ctaLabel, 180, 964);
      ctx.textAlign = 'left';

      // Brand name
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '600 16px Inter, system-ui, sans-serif';
      const brand = tenantData?.company || 'RIFX Marketing';
      const brandW = ctx.measureText(brand).width;
      ctx.fillText(brand, 1080 - brandW - 40, 1050);

      // Budget badge
      if (dailyBudget) {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.roundRect(1080 - 200, 50, 160, 40, 20);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 18px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$' + dailyBudget + '/dia', 1080 - 120, 76);
        ctx.textAlign = 'left';
      }

      const dataUrl = canvas.toDataURL('image/png', 0.95);
      setGeneratedBanner(dataUrl);
    } catch (err) {
      console.error('Error generating AI banner:', err);
      alert(language === 'en' ? 'Error generating image, retrying...' : 'Error generando imagen, reintentando...');
      // Fallback: simple gradient banner
      const canvas = document.createElement('canvas');
      canvas.width = 1080; canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;
      const g = ctx.createLinearGradient(0,0,1080,1080);
      g.addColorStop(0,'#0058bc'); g.addColorStop(1,'#1877F2');
      ctx.fillStyle = g; ctx.fillRect(0,0,1080,1080);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 56px Inter, sans-serif';
      ctx.fillText(result?.hook || campaignTitle || 'Tu Producto', 50, 500);
      setGeneratedBanner(canvas.toDataURL('image/png'));
    } finally {
      setIsGeneratingBanner(false);
    }
  };


  // Plan expiration check
  const isPlanExpired = React.useMemo(() => {
    if (!tenantData?.planExpiresAt) return false;
    return new Date(tenantData.planExpiresAt).getTime() < Date.now();
  }, [tenantData?.planExpiresAt]);

  // Force redirect to billing when plan is expired
  React.useEffect(() => {
    if (isPlanExpired && activeTab !== 'billing') {
      setActiveTab('billing');
    }
  }, [isPlanExpired, activeTab]);

  // Guarded setActiveTab -- blocks navigation when plan is expired
  const safeSetActiveTab = (tab: typeof activeTab) => {
    if (isPlanExpired && tab !== 'billing') return;
    setActiveTab(tab);
  };
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
      await authFetch('/api/panel/send-message', {
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

  const handleUpgradePlan = async (plan: string) => {
    try {
      setShowPlanConfirm(null);
      // Create Lemon Squeezy checkout session
      const res = await authFetch('/api/panel/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        // Open Lemon Squeezy checkout overlay or redirect
        if (typeof window !== 'undefined' && (window as any).LemonSqueezy) {
          (window as any).LemonSqueezy.Url.Open(data.checkoutUrl);
        } else {
          // Fallback: redirect to checkout page
          window.open(data.checkoutUrl, '_blank');
        }
      } else {
        alert(language === 'en' ? 'Error creating payment: ' + (data.error || 'Unknown') : 'Error al crear el pago: ' + (data.error || 'Desconocido'));
      }
    } catch (e) {
      console.error(e);
      alert(language === 'en' ? 'Error connecting to payment gateway' : 'Error al conectar con la pasarela de pagos');
    }
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

  // Admin Panel States
  const [adminData, setAdminData] = useState<any>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminTab, setAdminTab] = useState<'overview' | 'tenants' | 'announcements'>('overview');
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnMessage, setNewAnnMessage] = useState('');
  const [newAnnType, setNewAnnType] = useState<'info' | 'update' | 'warning' | 'promo'>('info');
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [editingTenantPlan, setEditingTenantPlan] = useState('trial');
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [platformAnnouncements, setPlatformAnnouncements] = useState<any[]>([]);
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(false);
  const [currentPopupAnnIndex, setCurrentPopupAnnIndex] = useState(0);
  const [currentBannerAnnIndex, setCurrentBannerAnnIndex] = useState(0);
  const [annImageFile, setAnnImageFile] = useState<File | null>(null);
  const [annImagePreview, setAnnImagePreview] = useState<string>('');
  const [annImageUploading, setAnnImageUploading] = useState(false);
  const [newAnnBtnText, setNewAnnBtnText] = useState('');
  const [newAnnBtnUrl, setNewAnnBtnUrl] = useState('');
  const annImageInputRef = useRef<HTMLInputElement>(null);
  const [annAiLoading, setAnnAiLoading] = useState(false);
  const [annAiImproved, setAnnAiImproved] = useState<{ title: string; message: string } | null>(null);
  const [annShowPreview, setAnnShowPreview] = useState(false);

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
    model_selection: 'gpt-4o',
    auto_classification: true,
    email_alerts: true,
    push_notifications: false,
    daily_briefing: true,
  });
  const originalConfigRef = React.useRef<any>(null);
  const configDataRef = React.useRef(configData);
  React.useEffect(() => { configDataRef.current = configData; }, [configData]);
  const [showWhatsappKey, setShowWhatsappKey] = useState(false);
  const [showWhatsappPanel, setShowWhatsappPanel] = useState(false);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [bulkSearch, setBulkSearch] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectAllContacts, setSelectAllContacts] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<{id: string, title: string, content: string}[]>([
    { id: '1', title: 'Promoción de Lunes', content: '¡Hola {Nombre}! Empezamos la semana con una oferta especial solo para ti. Escr\u00EDbenos para m\u00E1s info.' },
    { id: '2', title: 'Seguimiento', content: 'Hola {Nombre}, queríamos saber si pudiste revisar nuestra propuesta. Estamos aquí para ayudarte. ' },
    { id: '3', title: 'Recordatorio Demo', content: '¡Hola {Nombre}! Solo un recordatorio de que tienes una demo pendiente con nosotros. ¿Te parece bien agendar?' },
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

  // Analytics states
  const [analyticsRange, setAnalyticsRange] = useState<'30d' | '90d'>('30d');
  const [showHeaderCalendar, setShowHeaderCalendar] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [exportEndDate, setExportEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [analyticsCalMonth, setAnalyticsCalMonth] = useState(new Date().getMonth());
  const [analyticsCalYear, setAnalyticsCalYear] = useState(new Date().getFullYear());
  const [hoveredChartIdx, setHoveredChartIdx] = useState<number | null>(null);

  // Segments states
  const [showNewSegmentModal, setShowNewSegmentModal] = useState(false);
  const [newSegName, setNewSegName] = useState('');
  const [newSegDescription, setNewSegDescription] = useState('');
  const [newSegColor, setNewSegColor] = useState('violet');
  const [newSegKeywords, setNewSegKeywords] = useState('');
  const [newSegConfidence, setNewSegConfidence] = useState(80);
  const [customSegments, setCustomSegments] = useState<{id: string, name: string, description: string, color: string, keywords: string[], confidence: number, createdAt: string}[]>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('rifx_custom_segments') || '[]'); } catch { return []; }
    }
    return [];
  });
  const [segDetailView, setSegDetailView] = useState<'interested' | 'chatting' | 'bought' | string>('interested');
  const [segTablePage, setSegTablePage] = useState(1);
  const [segViewMode, setSegViewMode] = useState<'live' | 'archive'>('live');

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
    if (!confirm(language === 'en' ? 'Are you sure? This will permanently delete ALL conversations and messages. This action cannot be undone.' : 'Esta seguro? Esto eliminara TODAS las conversaciones y mensajes permanentemente. Esta accion no se puede deshacer.')) {
      return;
    }
    setMemoryClearing(true);
    setMemoryClearSuccess(false);
    try {
      const res = await authFetch('/api/panel/memory', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setConversationsData(null);
        setStatsData(null);
        setMemoryUsage({ totalMessages: 0, totalConversations: 0, oldestDays: 0 });
        setMemoryClearSuccess(true);
        setTimeout(() => setMemoryClearSuccess(false), 5000);
      } else {
        alert(data.error || 'Error al borrar memoria');
      }
    } catch {
      alert(language === 'en' ? 'Network error clearing memory' : 'Error de red al borrar memoria');
    } finally {
      setMemoryClearing(false);
    }
  };

  const handleVerifyAiKey = async (silentOrEvent: boolean | React.MouseEvent = false) => {
    const silent = typeof silentOrEvent === 'boolean' ? silentOrEvent : false;
    const providerMap = { openai: 'openai_key', gemini: 'gemini_key', groq: 'groq_key' } as const;
    // Use ref to always get the latest config data (avoids stale closures)
    const latestConfig = configDataRef.current;
    const key = latestConfig[providerMap[selectedAiProvider]];
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
  // Helper: fetch with auth token
  const authFetch = (url: string, options: RequestInit = {}) => {
    const token = authToken || localStorage.getItem('rifx_token');
    const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  const fetchConversations = () => {
    authFetch('/api/panel/conversations')
      .then(res => res.json())
      .then(data => {
        setConversationsData(data);
        checkHumanAlerts(data);
      })
      .catch(console.error);
  };

  const fetchConfig = React.useCallback(() => {
    authFetch('/api/panel/config')
      .then(res => res.json())
      .then(data => {
          if (!data.error) {
            const parsed = {
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
             confidence_threshold: data.confidence_threshold ?? 0.85,
             model_selection: data.model_selection || 'gpt-4o',
             auto_classification: data.auto_classification !== undefined ? data.auto_classification : true,
             email_alerts: data.email_alerts !== undefined ? data.email_alerts : true,
             push_notifications: data.push_notifications !== undefined ? data.push_notifications : false,
             daily_briefing: data.daily_briefing !== undefined ? data.daily_briefing : true,
            };
            setConfigData(parsed);
            originalConfigRef.current = { ...parsed };
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
      authFetch('/api/panel/stats')
        .then(res => res.json())
        .then(data => setStatsData(data))
        .catch(console.error);

      // Cargar Config
      fetchConfig();

      // Refrescar cada 10 segundos
      const interval = setInterval(() => {
        authFetch('/api/panel/conversations').then(res => res.json()).then(data => {
          setConversationsData(data);
          checkHumanAlerts(data);
        });
        authFetch('/api/panel/stats').then(res => res.json()).then(data => setStatsData(data));
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  // Auto-verify AI key whenever config loads or provider changes (works like WhatsApp - always shows status)
  const aiAutoVerifyKeyRef = React.useRef('');
  React.useEffect(() => {
    if (!isLoggedIn) return;
    const currentKey = selectedAiProvider === 'openai' ? configData.openai_key : selectedAiProvider === 'gemini' ? configData.gemini_key : configData.groq_key;
    const verifySignature = `${selectedAiProvider}:${currentKey}`;
    // Only re-verify if provider or key changed
    if (currentKey && currentKey.length > 5 && aiAutoVerifyKeyRef.current !== verifySignature) {
      aiAutoVerifyKeyRef.current = verifySignature;
      const timer = setTimeout(() => {
        handleVerifyAiKey(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, selectedAiProvider, configData.openai_key, configData.gemini_key, configData.groq_key]);

  // Auto-verify WhatsApp when settings tab opens
  const waAutoVerifiedRef = React.useRef(false);
  React.useEffect(() => {
    if (activeTab === 'settings' && isLoggedIn && !waAutoVerifiedRef.current) {
      waAutoVerifiedRef.current = true;
      const timer = setTimeout(() => { handleVerifyWhatsApp(true); }, 800);
      return () => clearTimeout(timer);
    }
  }, [activeTab, isLoggedIn, configData.whatsapp_token, configData.whatsapp_phone_id]);

  // Fetch memory usage when settings tab opens
  React.useEffect(() => {
    if (activeTab === 'settings' && isLoggedIn) {
      authFetch('/api/panel/stats').then(r => r.json()).then(data => {
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
      if (isRegistering) {
        // Register new tenant
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: registerEmail || loginUser,
            password: loginPass,
            companyName: registerCompany || 'Mi Empresa',
            ownerName: registerOwner || '',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setLoginError(data.error || 'Error al registrarse');
          setIsLoggingIn(false);
          return;
        }
        localStorage.setItem('rifx_token', data.token);
        setAuthToken(data.token);
        setTenantData(data.tenant);
        setIsLoggedIn(true);
        setIsRegistering(false);
      } else {
        // Login existing tenant
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: loginUser, password: loginPass }),
        });
        const data = await res.json();
        if (!res.ok) {
          setLoginError(data.error || 'Email o contraseña incorrectos');
          setIsLoggingIn(false);
          return;
        }
        localStorage.setItem('rifx_token', data.token);
        setAuthToken(data.token);
        setTenantData(data.tenant);
        setCurrentPlan(data.tenant.plan || 'trial');
        setIsLoggedIn(true);
      }
    } catch (err: any) {
      setLoginError('Error de conexión. Intenta de nuevo.');
    }
    setIsLoggingIn(false);
  };

  // Auto-login from stored token
  React.useEffect(() => {
    const token = localStorage.getItem('rifx_token');
    if (token) {
      setAuthToken(token);
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          // Quick login from token
          setTenantData({ id: payload.tenantId, email: payload.email, plan: payload.plan, isAdmin: payload.isAdmin });
          setCurrentPlan(payload.plan || 'trial');
          setIsLoggedIn(true);
          // Then fetch fresh data from DB
          fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data) {
                setTenantData(data);
                setCurrentPlan(data.plan || 'trial');
              }
            })
            .catch(() => {});
        } else {
          localStorage.removeItem('rifx_token');
        }
      } catch { localStorage.removeItem('rifx_token'); }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('rifx_token');
    setAuthToken(null);
    setTenantData(null);
    setIsLoggedIn(false);
    setLoginUser('');
    setLoginPass('');
  };

  // ============ ADMIN PANEL FUNCTIONS ============
  const loadAdminData = async () => {
    if (!tenantData?.isAdmin) return;
    setAdminLoading(true);
    try {
      const res = await authFetch('/api/admin/dashboard');
      if (res.ok) {
        const data = await res.json();
        setAdminData(data);
      }
    } catch (e) { console.error('Error cargando admin data:', e); }
    setAdminLoading(false);
  };

  const handleCreateAnnouncement = async () => {
    if (!newAnnTitle.trim() || !newAnnMessage.trim()) return;
    setAdminActionLoading(true);
    try {
      let imageUrl = '';
      
      // Upload image first if provided
      if (annImageFile) {
        setAnnImageUploading(true);
        const formData = new FormData();
        formData.append('image', annImageFile);
        const uploadRes = await authFetch('/api/admin/upload', {
          method: 'POST',
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          imageUrl = uploadData.imageUrl;
        }
        setAnnImageUploading(false);
      }
      
      const res = await authFetch('/api/admin/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create_announcement', 
          title: newAnnTitle, 
          message: newAnnMessage, 
          type: newAnnType,
          image_url: imageUrl || null,
          button_text: newAnnBtnText || null,
          button_url: newAnnBtnUrl || null,
        }),
      });
      if (res.ok) {
        setNewAnnTitle(''); setNewAnnMessage(''); setShowAnnForm(false);
        setAnnImageFile(null); setAnnImagePreview('');
        setNewAnnBtnText(''); setNewAnnBtnUrl('');
        loadAdminData();
      }
    } catch (e) { console.error(e); }
    setAdminActionLoading(false);
  };

  // IA: Mejorar anuncio antes de publicar
  const handleImproveAnnouncement = async () => {
    if (!newAnnTitle.trim() && !newAnnMessage.trim()) return;
    setAnnAiLoading(true);
    setAnnAiImproved(null);
    try {
      const res = await authFetch('/api/admin/improve-announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newAnnTitle,
          message: newAnnMessage,
          type: newAnnType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.improved) {
          setAnnAiImproved(data.improved);
          setAnnShowPreview(true);
        }
      } else {
        alert('Error de IA: ' + (data.error || 'Respuesta fallida del servidor'));
        console.error('Error IA API:', data);
      }
    } catch (e: any) { 
      console.error('Error mejorando anuncio:', e); 
      alert('Error mejorando anuncio: ' + e?.message);
    }
    setAnnAiLoading(false);
  };

  // Aprobar mejora de IA y aplicar al formulario
  const handleApproveAiAnnouncement = () => {
    if (annAiImproved) {
      setNewAnnTitle(annAiImproved.title);
      setNewAnnMessage(annAiImproved.message);
      setAnnAiImproved(null);
      setAnnShowPreview(false);
    }
  };


  const handleAnnImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAnnImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setAnnImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    setAdminActionLoading(true);
    try {
      await authFetch('/api/admin/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_announcement', announcementId: id }),
      });
      loadAdminData();
    } catch (e) { console.error(e); }
    setAdminActionLoading(false);
  };

  const handleToggleAnnouncement = async (id: string, isActive: boolean) => {
    try {
      await authFetch('/api/admin/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_announcement', announcementId: id, isActive }),
      });
      loadAdminData();
    } catch (e) { console.error(e); }
  };

  const handleUpdateTenantPlan = async (targetTenantId: string, plan: string) => {
    setAdminActionLoading(true);
    try {
      await authFetch('/api/admin/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_tenant_plan', targetTenantId, plan }),
      });
      setEditingTenantId(null);
      loadAdminData();
    } catch (e) { console.error(e); }
    setAdminActionLoading(false);
  };

  const handleToggleAdmin = async (targetTenantId: string, isAdmin: boolean) => {
    try {
      await authFetch('/api/admin/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_admin', targetTenantId, isAdmin }),
      });
      loadAdminData();
    } catch (e) { console.error(e); }
  };

  // Fetch announcements for user dashboard
  const fetchAnnouncements = async () => {
    try {
      const res = await authFetch('/api/announcements');
      if (res.ok) {
        const data = await res.json();
        const anns = data.announcements || [];
        setPlatformAnnouncements(anns);
        
        // Show popup if there is at least one announcement not dismissed
        if (anns.length > 0) {
          const hasUnseen = anns.some((ann: any) => !sessionStorage.getItem(`rifx_ann_dismissed_${ann.id}`));
          if (hasUnseen) {
            setCurrentPopupAnnIndex(0);
            setShowAnnouncementPopup(true);
          }
        }
      }
    } catch {}
  };

  const dismissAnnouncementPopup = () => {
    platformAnnouncements.forEach(ann => {
      sessionStorage.setItem(`rifx_ann_dismissed_${ann.id}`, 'true');
    });
    setShowAnnouncementPopup(false);
  };

  React.useEffect(() => {
    if (activeTab === 'admin' && tenantData?.isAdmin) { loadAdminData(); }
    if (activeTab === 'dashboard' && isLoggedIn) { fetchAnnouncements(); }
  }, [activeTab, tenantData?.isAdmin]);

  React.useEffect(() => {
    if (isLoggedIn) { fetchAnnouncements(); }
  }, [isLoggedIn]);

  const handleTestChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim() || isTestingAi) return;

    const userMsg = testInput;
    setTestInput('');
    setTestMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTestingAi(true);

    try {
      const res = await authFetch('/api/panel/test-ai', {
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
      const res = await authFetch('/api/panel/contact-scores', {
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

  // === Analytics Computed Data ===
  const revenueChartData = React.useMemo(() => {
    const days = analyticsRange === '90d' ? 90 : 30;
    const data: { date: string; label: string; amount: number }[] = [];
    const dailyIncome = statsData?.dailyIncome || {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { month: 'short', day: 'numeric' });
      data.push({ date: key, label, amount: dailyIncome[key] || 0 });
    }
    return data;
  }, [statsData?.dailyIncome, analyticsRange, language]);

  const revenueSvgData = React.useMemo(() => {
    if (revenueChartData.length === 0) return { line: '', area: '', points: [] as {x:number,y:number,amount:number,label:string}[] };
    const maxVal = Math.max(...revenueChartData.map(d => d.amount), 100);
    const w = 800, h = 200, pad = 10;
    const pts = revenueChartData.map((d, i) => ({
      x: revenueChartData.length === 1 ? w / 2 : (i / (revenueChartData.length - 1)) * w,
      y: pad + (h - 2 * pad) * (1 - d.amount / maxVal),
      amount: d.amount,
      label: d.label,
    }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = line + ` L${w},${h} L0,${h} Z`;
    return { line, area, points: pts };
  }, [revenueChartData]);

  const periodRevenue = React.useMemo(() => revenueChartData.reduce((s, d) => s + d.amount, 0), [revenueChartData]);

  const conversionRate = React.useMemo(() => {
    const total = allContacts.length || 1;
    const sales = statsData?.totalSales || 0;
    return Math.round((sales / total) * 1000) / 10;
  }, [allContacts.length, statsData?.totalSales]);

  const analyticsCalDays = React.useMemo(() => {
    const dim = getDaysInMonth(analyticsCalYear, analyticsCalMonth);
    const first = getFirstDayOfWeek(analyticsCalYear, analyticsCalMonth);
    const dailyIncome = statsData?.dailyIncome || {};
    const days: (null | { day: number; amount: number; date: string })[] = [];
    for (let i = 0; i < first; i++) days.push(null);
    for (let d = 1; d <= dim; d++) {
      const key = `${analyticsCalYear}-${String(analyticsCalMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, amount: dailyIncome[key] || 0, date: key });
    }
    return days;
  }, [analyticsCalYear, analyticsCalMonth, statsData?.dailyIncome]);

  const calMonthTotal = React.useMemo(() => analyticsCalDays.filter(Boolean).reduce((s, d) => s + (d?.amount || 0), 0), [analyticsCalDays]);

  const handleExportExcel = () => {
    const dailyIncome = statsData?.dailyIncome || {};
    const start = new Date(exportStartDate);
    const end = new Date(exportEndDate);
    const BOM = '\uFEFF';
    let csv = BOM;
    csv += 'RIFX CRM - Reporte de Ventas\n';
    csv += `Periodo: ${exportStartDate} al ${exportEndDate}\n`;
    csv += `Generado: ${new Date().toLocaleString('es')}\n\n`;
    csv += 'Fecha,Ingresos ($),Estado\n';
    let totalAmount = 0;
    const current = new Date(start);
    while (current <= end) {
      const key = current.toISOString().split('T')[0];
      const amount = dailyIncome[key] || 0;
      csv += `${key},$${amount.toFixed(2)},${amount > 0 ? 'Con ventas' : 'Sin ventas'}\n`;
      totalAmount += amount;
      current.setDate(current.getDate() + 1);
    }
    csv += `\nTOTAL,$${totalAmount.toFixed(2)},\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RIFX_Ventas_${exportStartDate}_${exportEndDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  // Persist custom segments
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rifx_custom_segments', JSON.stringify(customSegments));
    }
  }, [customSegments]);

  const handleCreateSegment = () => {
    if (!newSegName.trim()) return;
    const seg = {
      id: Date.now().toString(),
      name: newSegName.trim(),
      description: newSegDescription.trim(),
      color: newSegColor,
      keywords: newSegKeywords.split(',').map(k => k.trim()).filter(Boolean),
      confidence: newSegConfidence,
      createdAt: new Date().toISOString(),
    };
    setCustomSegments(prev => [...prev, seg]);
    setNewSegName(''); setNewSegDescription(''); setNewSegKeywords(''); setNewSegConfidence(80); setNewSegColor('violet');
    setShowNewSegmentModal(false);
  };

  const handleDeleteSegment = (id: string) => {
    setCustomSegments(prev => prev.filter(s => s.id !== id));
  };

  const segDetailContacts = React.useMemo(() => {
    if (segDetailView === 'interested') return conversationsData?.interested || [];
    if (segDetailView === 'chatting') return conversationsData?.chatting || [];
    if (segDetailView === 'bought') return conversationsData?.bought || [];
    // Custom segment: match contacts by keywords in their conversation
    return allContacts;
  }, [segDetailView, conversationsData, allContacts]);

  const segDetailLabel = React.useMemo(() => {
    if (segDetailView === 'interested') return language === 'en' ? 'Interested' : 'Interesados';
    if (segDetailView === 'chatting') return language === 'en' ? 'Undecided' : 'Indecisos';
    if (segDetailView === 'bought') return language === 'en' ? 'Curious' : 'Curiosos';
    const seg = customSegments.find(s => s.id === segDetailView);
    return seg?.name || '';
  }, [segDetailView, language, customSegments]);

  const SEG_ROWS = 8;
  const totalSegPages = Math.max(1, Math.ceil(segDetailContacts.length / SEG_ROWS));
  const pagedSegContacts = segDetailContacts.slice((segTablePage - 1) * SEG_ROWS, segTablePage * SEG_ROWS);

  const handleExportSegmentCSV = () => {
    const contacts = segDetailContacts;
    const BOM = '\uFEFF';
    let csv = BOM;
    csv += `RIFX CRM - Segmento: ${segDetailLabel}\n`;
    csv += `Generado: ${new Date().toLocaleString('es')}\n`;
    csv += `Total contactos: ${contacts.length}\n\n`;
    csv += 'Nombre,Teléfono,Estado,Última Actividad\n';
    contacts.forEach((c: any) => {
      csv += `${c.customer_name || 'Sin nombre'},${c.phone_number || ''},${c.status || ''},${c.updated_at || c.created_at || ''}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RIFX_Segmento_${segDetailLabel}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
        const res = await authFetch('/api/panel/send-message', {
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
      const res = await authFetch('/api/panel/config', {
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

  const handleSaveSettings = async (e: React.FormEvent | React.MouseEvent) => {
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
        alert_email: configData.alert_email,
        model_selection: configData.model_selection,
        confidence_threshold: configData.confidence_threshold,
        auto_classification: configData.auto_classification,
      };
      console.log('Enviando config payload:', Object.keys(payload));
      const res = await authFetch('/api/panel/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setShowSuccess(true);
        // Recargar config para confirmar que se guardó
        fetchConfig();
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        const errMsg = result.error || 'Error desconocido al guardar';
        setSaveError(errMsg);
        console.error('X  Error guardando config:', errMsg);
        alert('Error guardando configuración: ' + errMsg);
        setTimeout(() => setSaveError(''), 8000);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || 'Error de conexión al guardar';
      setSaveError(errMsg);
      alert('Error de conexión: ' + errMsg);
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
                <>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Nombre de tu Empresa</label>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-600 group-focus-within:text-brand-blue transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                    </span>
                    <input 
                      type="text" 
                      value={registerCompany}
                      onChange={(e) => setRegisterCompany(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm text-white placeholder-gray-600 focus:ring-0" 
                      placeholder="Mi Empresa S.A." 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Tu Nombre</label>
                  <div className="relative group">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-600 group-focus-within:text-brand-blue transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    </span>
                    <input 
                      type="text" 
                      value={registerOwner}
                      onChange={(e) => setRegisterOwner(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm text-white placeholder-gray-600 focus:ring-0" 
                      placeholder="Juan Pérez" 
                    />
                  </div>
                </div>
                </>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Email</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-600 group-focus-within:text-brand-blue transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  </span>
                  <input 
                    type="email" 
                    value={loginUser}
                    onChange={(e) => setLoginUser(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl glass-input text-sm text-white placeholder-gray-600 focus:ring-0" 
                    placeholder="correo@ejemplo.com" 
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
              {!isRegistering ? (
                <button type="button" onClick={() => setIsRegistering(true)} className="w-full text-center text-[11px] text-gray-500 hover:text-white transition-colors uppercase tracking-wider font-bold">
                  ¿No tienes cuenta? <span className="text-brand-blue">Crear Cuenta Gratis</span>
                </button>
              ) : (
                <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-center text-[11px] text-gray-500 hover:text-white transition-colors uppercase tracking-wider font-bold">
                  ¿Ya tienes cuenta? <span className="text-brand-blue">Iniciar Sesión</span>
                </button>
              )}
              <div className="flex items-center gap-3 text-[10px] text-gray-600 uppercase tracking-wider mt-4">
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
          <button onClick={() => safeSetActiveTab('dashboard')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'dashboard' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : isPlanExpired ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined">dashboard</span>
            <span>{language === 'en' ? 'Dashboard' : 'Panel Principal'}</span>
            {isPlanExpired && <span className="material-symbols-outlined text-sm ml-auto text-slate-300">lock</span>}
          </button>
          <button onClick={() => safeSetActiveTab('crm')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'crm' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : isPlanExpired ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>group</span>
            <span>{language === 'en' ? 'Users' : 'Usuarios'}</span>
            {isPlanExpired && <span className="material-symbols-outlined text-sm ml-auto text-slate-300">lock</span>}
          </button>
          <button onClick={() => safeSetActiveTab('settings')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'settings' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : isPlanExpired ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined">settings</span>
            <span>{language === 'en' ? 'Settings' : 'Configuraciones'}</span>
            {isPlanExpired && <span className="material-symbols-outlined text-sm ml-auto text-slate-300">lock</span>}
          </button>
          <button onClick={() => safeSetActiveTab('billing')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'billing' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300 ${isPlanExpired ? 'ring-2 ring-red-400/50 rounded-lg' : ''}`}>
            <span className="material-symbols-outlined">payments</span>
            <span>{language === 'en' ? 'Plans & Billing' : 'Pagos'}</span>
            {isPlanExpired && <span className="text-[9px] ml-auto bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">!</span>}
          </button>
        
          <button onClick={() => safeSetActiveTab('playground')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'playground' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : isPlanExpired ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined">smart_toy</span>
            <span>{language === 'en' ? 'AI Playground' : 'Playground IA'}</span>
            {isPlanExpired && <span className="material-symbols-outlined text-sm ml-auto text-slate-300">lock</span>}
          </button>
          <button onClick={() => safeSetActiveTab('campaigns')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'campaigns' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : isPlanExpired ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined">campaign</span>
            <span>{language === 'en' ? 'Ad Campaigns' : 'Pautas Publicitarias'}</span>
            {isPlanExpired && <span className="material-symbols-outlined text-sm ml-auto text-slate-300">lock</span>}
          </button>
          <button onClick={() => safeSetActiveTab('segments')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'segments' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : isPlanExpired ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined">pie_chart</span>
            <span>{language === 'en' ? 'Segments' : 'Segmentos'}</span>
            {isPlanExpired && <span className="material-symbols-outlined text-sm ml-auto text-slate-300">lock</span>}
          </button>
          <button onClick={() => safeSetActiveTab('analytics')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'analytics' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : isPlanExpired ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300`}>
            <span className="material-symbols-outlined">monitoring</span>
            <span>{language === 'en' ? 'Analytics' : 'Análisis'}</span>
            {isPlanExpired && <span className="material-symbols-outlined text-sm ml-auto text-slate-300">lock</span>}
          </button>

          {tenantData?.isAdmin && (
            <>
              <div className="my-2 border-t border-slate-200/50"></div>
              <button onClick={() => safeSetActiveTab('admin')} className={`flex w-full items-center gap-3 px-4 py-3 ${activeTab === 'admin' ? 'bg-gradient-to-r from-amber-50 to-orange-50 text-orange-700 rounded-lg shadow-sm font-bold scale-[0.98]' : isPlanExpired ? 'text-slate-300 cursor-not-allowed' : 'text-orange-500/70 hover:text-orange-600 font-medium'} transition-all duration-300`}>
                <span className="material-symbols-outlined">admin_panel_settings</span>
                <span>{language === 'en' ? 'Admin Panel' : 'Panel Admin'}</span>
                {isPlanExpired && <span className="material-symbols-outlined text-sm ml-auto text-slate-300">lock</span>}
              </button>
            </>
          )}
</nav>
        <div className="mt-auto flex flex-col gap-4">
          <div className="pt-4 border-t border-slate-200/50 flex flex-col gap-1">
            <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-error transition-colors text-sm w-full text-left">
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
              <p className="text-xs font-bold text-primary">{tenantData?.companyName || tenantData?.email?.split('@')[0] || 'Admin'}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{tenantData?.plan ? `Plan ${tenantData.plan}` : 'Administrator'}</p>
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
            {/* MainContent Grid */}
            <div className="grid grid-cols-12 gap-6">
              {/* LeftPromoBanner -- Dynamic from Announcements */}
              <section className="col-span-12 lg:col-span-3">
                <div className="relative rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-100 h-full min-h-[600px] flex flex-col">
                  {(() => {
                    const bannerAnn = platformAnnouncements[currentBannerAnnIndex];
                    const typeBadge: Record<string, { label: string; color: string }> = {
                      info: { label: 'Info', color: 'bg-blue-600' },
                      update: { label: 'Nuevo', color: 'bg-violet-600' },
                      warning: { label: 'Aviso Importante', color: 'bg-red-600' },
                      promo: { label: 'Promo', color: 'bg-emerald-600' },
                    };
                    const badge = typeBadge[bannerAnn?.type] || typeBadge.update;
                    
                    if (bannerAnn) {
                      return (
                        <div className="h-full w-full relative flex flex-col">
                          {/* Image area */}
                          {bannerAnn.image_url ? (
                            <div className="relative w-full h-[280px] flex-shrink-0">
                              <img src={bannerAnn.image_url} alt={bannerAnn.title} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />
                            </div>
                          ) : (
                            <div className="relative w-full h-[200px] flex-shrink-0 bg-gradient-to-br from-primary-container via-blue-600 to-indigo-700 flex items-center justify-center">
                              <span className="material-symbols-outlined text-white/30 text-[120px]">campaign</span>
                              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white" />
                            </div>
                          )}
                          {/* Carousel controls if multiple announcements */}
                          {platformAnnouncements.length > 1 && (
                            <div className="absolute top-4 right-4 flex gap-2 z-20">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setCurrentBannerAnnIndex((prev) => (prev > 0 ? prev - 1 : platformAnnouncements.length - 1)); }}
                                className="w-8 h-8 rounded-full bg-black/30 backdrop-blur text-white flex items-center justify-center hover:bg-black/50 transition-colors"
                              >
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setCurrentBannerAnnIndex((prev) => (prev < platformAnnouncements.length - 1 ? prev + 1 : 0)); }}
                                className="w-8 h-8 rounded-full bg-black/30 backdrop-blur text-white flex items-center justify-center hover:bg-black/50 transition-colors"
                              >
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                              </button>
                            </div>
                          )}
                          {/* Content */}
                          <div className="relative z-10 p-8 flex flex-col flex-1 justify-between -mt-8">
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <span className={`inline-block ${badge.color} text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider`}>{badge.label}</span>
                                {platformAnnouncements.length > 1 && (
                                  <div className="flex gap-1">
                                    {platformAnnouncements.map((_, idx) => (
                                      <div key={idx} className={`w-1.5 h-1.5 rounded-full ${idx === currentBannerAnnIndex ? 'bg-primary-container' : 'bg-slate-300'}`} />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">{bannerAnn.title}</h2>
                              <p className="text-slate-600 text-sm leading-relaxed">{bannerAnn.message}</p>
                            </div>
                            {bannerAnn.button_text && (
                              <div className="mt-auto pt-6">
                                <button onClick={() => bannerAnn.button_url && window.open(bannerAnn.button_url, '_blank')} className="bg-primary-container text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:opacity-90 transition-all flex items-center gap-2 w-full justify-center">
                                  {bannerAnn.button_text}
                                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" fillRule="evenodd"></path></svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    // Fallback: default promo
                    return (
                      <div className="h-full w-full relative bg-gradient-to-br from-indigo-600 via-blue-700 to-primary-container flex flex-col">
                        <div className="relative z-10 p-8 flex flex-col h-full justify-between">
                          <div className="space-y-4">
                            <span className="inline-block bg-white/20 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">RIFX CRM</span>
                            <h2 className="text-3xl font-extrabold text-white leading-tight">
                              Tu CRM inteligente con <span className="text-amber-300">IA integrada</span>
                            </h2>
                            <p className="text-white/80 text-sm">Automatiza tus ventas, gestiona contactos y escala tu negocio con inteligencia artificial</p>
                          </div>
                          <div className="mt-auto pt-6">
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                              <p className="text-white/60 text-[10px] uppercase tracking-wider font-bold mb-1">Plan Actual</p>
                              <p className="text-white text-lg font-black capitalize">{
                                (tenantData?.plan || currentPlan) === 'trial' ? 'Prueba Gratuita' 
                                : `Chatea Pro ${(tenantData?.plan || currentPlan || 'trial').charAt(0).toUpperCase() + (tenantData?.plan || currentPlan || 'trial').slice(1)}`
                              }</p>
                              {tenantData?.planExpiresAt && (() => {
                                const dl = Math.max(0, Math.ceil((new Date(tenantData.planExpiresAt).getTime() - Date.now()) / (1000*60*60*24)));
                                return <p className={`text-xs mt-1 ${dl <= 3 ? 'text-amber-300 font-bold' : 'text-white/60'}`}>{dl > 0 ? `${dl} d\u00edas restantes` : 'Plan expirado'}</p>;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </section>

              {/* RightDashboardArea */}
              <section className="col-span-12 lg:col-span-9 space-y-6">
                {/* ExpertTeamSection */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  {/* Plan Info Bar */}
                  {(() => {
                    const plan = tenantData?.plan || currentPlan || 'trial';
                    const planNames: Record<string, string> = { trial: 'Prueba Gratuita (14 d\u00edas)', start: 'Chatea Pro Start', advanced: 'Chatea Pro Advanced', plus: 'Chatea Pro Plus', master: 'Chatea Pro Master' };
                    const planDays: Record<string, number> = { trial: 14, start: 30, advanced: 30, plus: 30, master: 30 };
                    const planContacts: Record<string, number> = { trial: 200, start: 1000, advanced: 10000, plus: 20000, master: 50000 };
                    const planBots: Record<string, number> = { trial: 1, start: 1, advanced: 1, plus: 1, master: 5 };
                    const planMembers: Record<string, number> = { trial: 1, start: 5, advanced: 5, plus: 5, master: 10 };
                    const planStorage: Record<string, string> = { trial: '100 MB', start: '250 MB', advanced: '500 MB', plus: '1.0 GB', master: '2.0 GB' };

                    // Calculate days remaining
                    const expiresAt = tenantData?.planExpiresAt ? new Date(tenantData.planExpiresAt) : null;
                    const totalDays = planDays[plan] || 14;
                    let daysUsed = totalDays;
                    let daysLeft = 0;
                    if (expiresAt) {
                      const now = new Date();
                      daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                      daysUsed = Math.max(0, totalDays - daysLeft);
                    }
                    const progressPercent = Math.min(100, (daysUsed / totalDays) * 100);
                    const isExpired = daysLeft <= 0;
                    const isExpiringSoon = daysLeft <= 3 && daysLeft > 0;

                    // Format expiration date
                    const expiresStr = expiresAt ? expiresAt.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

                    // Contact count
                    const contactCount = allContacts?.length || 0;
                    const maxContacts = planContacts[plan] || 200;
                    const storageUsed = tenantData?.storageUsedBytes ? `${(tenantData.storageUsedBytes / (1024*1024)).toFixed(1)} MB` : '0 MB';

                    return (
                      <div className={`px-6 py-3 border-b border-slate-100 ${isExpired ? 'bg-gradient-to-r from-red-500 to-red-600' : isExpiringSoon ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-primary-container to-blue-600'}`}>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-1.5 rounded">
                              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                            </div>
                            <div className="text-xs text-white">
                              <p className="font-semibold">Plan actual</p>
                              <p className="text-white/80">{planNames[plan] || plan}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right text-white">
                              <p className="text-lg font-bold leading-none">{daysUsed} / <span className="font-normal opacity-70">{totalDays}</span></p>
                              <p className="text-[10px] uppercase tracking-tight opacity-70">{isExpired ? 'plan expirado' : 'd\u00edas usados'}</p>
                            </div>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${isExpired ? 'bg-red-300' : isExpiringSoon ? 'bg-amber-300' : progressPercent > 75 ? 'bg-orange-400' : 'bg-emerald-400'}`} style={{width: `${progressPercent}%`}}></div>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-[10px] text-white/70">
                            {isExpired 
                              ? <><span className="text-white font-bold">Tu plan ha expirado.</span> · <span className="underline cursor-pointer hover:text-white" onClick={() => setActiveTab('billing')}>Renovar ahora</span></>
                              : <>Tu plan {plan === 'trial' ? 'de prueba' : ''} expira el {expiresStr} · <span className="font-bold text-white">{daysLeft} {daysLeft === 1 ? 'd\u00eda' : 'd\u00edas'} restantes</span> · <span className="underline cursor-pointer hover:text-white" onClick={() => setActiveTab('billing')}>Ver planes</span></>
                            }
                          </p>
                          <div className="flex gap-2">
                            <div className="bg-white/15 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/20">{contactCount}/{maxContacts.toLocaleString()}</div>
                            <div className="bg-white/15 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/20">– {planBots[plan]}</div>
                            <div className="bg-white/15 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/20"> {planMembers[plan]}</div>
                            <div className="bg-white/15 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/20">{storageUsed}/{planStorage[plan]}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Expert Cards */}
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                      {name:'Experta en ventas por WhatsApp', img:'AB6AXuDWSe1_L4wZI5vciZ440fFRXGRX_Jy9mCsJqKWeDk4HE-Ljl3Gu1E5Pv7_L5NcYJqr2ETTpZFeExyCE2XypIEK2vjXJ0SCDYSJq2e6JfyCMI1LiPfaGw-Rc7j5TAylDR9nwUkBTwNbCNVnfE-Vc3MP-d0zr9TEtqCyQ8oWyL8YTEdNqstELBp_-riW1gRIx0nsqFnvVXus0zVvMi-eEMcgGTj2vSQ5OntWsKkBqzkLYJ0jOJrd9yO6AC96gavZF11KkwhvPXDVE5YNa', online:true},
                      {name:'Experto en logística', img:'AB6AXuBarYnXjTbS-YJFpfnLAYCtwnxMj4ecyo7lrGhGhkFAUtOluIPILBVpU9s63y6cW4s4lP4roXHMufp8eRBhm9RUVHPxC3cg8rWAbH5PnPjYIn_DSTgbolwSjPY1h_8tkVvEHCoOA7w0CWds5V9KapKNkkL2WPLYK_nhweD_by8E8fCUJRTw51XISU4En28JsnHZJRL9c262ihr6zZc44qvxfM0aPZbmQkEHOHvu_FgXciisI5QLgbr7Fn3B3Lb4oKTrGQeoaDrxd3ns', online:true},
                      {name:'Especialista en recuperar carritos', img:'AB6AXuDw1TVF3SLRu-VMyIJGiH1m5ts4tKm4LYiPHm4oxOyzu3eZ_T6mp7gbMK1PN5IaC9_tDFYa3xZJoovjUvZg8iCJMP_kOlN5-m9zgjdYRo-U3LC3iIN38ckThN3YvkwB2ufNpLclTsPRElladsSOymDJYSApwZt1bcyG9Y4l_O17x3T0dcXG6tAXzDx21fulMb7Ife5-VDGCD7DiKXVMZBDR1EV7e-RLU_uKmpb4mA_pBVEcgwJ6bYZ_P0KPerwVqyi0AC1o6aH42daD', online:true},
                      {name:'Mediadora de comentarios', img:'AB6AXuC1YTh3EdBAV_bv7N9aDXXB4YN4CgT4dUWwGTMvsPQesCRs_6YrPjx0uQKlZaivH1UYEwHBjzm6RR8Z2yImFDqmeDTukmPil6BBLbJzstpdCzuXxpsSk6GxYtJ4ak2QExlzDvVUEtlXnYtSq_qHXrhHTEo732Sm8qtAxRNcl_xxYh7WQ1zHQsDR6eXrqLTR4bNRzDvRw90ND0ODSVcSrkaliCv_GTtiJ9v0CUnnM_9_xwIhh-1bxMhpg9ymyIw4DaUREtW32ruDnX7J', online:true},
                    ].map((expert, i) => (
                      <div key={i} className="bg-crm-surface-container-low border border-slate-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow group">
                        <div className="relative w-20 h-20 mx-auto mb-4">
                          <img alt={expert.name} className="rounded-full w-full h-full object-cover border-2 border-white shadow-sm group-hover:scale-105 transition-transform" src={`https://lh3.googleusercontent.com/aida-public/${expert.img}`} />
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
                      <svg className="h-5 w-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" fillRule="evenodd"></path></svg>
                      <span className="text-sm font-semibold">Te faltan 4 expertos para optimizar tu flujo</span>
                    </div>
                    <button onClick={() => setActiveTab('billing')} className="bg-primary-container text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-primary-container/90 shadow-sm transition-all flex items-center gap-2">
                      Completar
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    </button>
                  </div>
                </div>

                {/* Bottom two cards row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Actualizaciones */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px] overflow-hidden">
                    <div className="bg-orange-500 p-4 flex justify-between items-center text-white rounded-t-2xl">
                      <div>
                        <h3 className="font-bold text-lg leading-none">Actualizaciones</h3>
                        <p className="text-xs text-white/80 mt-1">Nuevas funciones disponibles</p>
                      </div>
                      <div className="relative">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                        <span className="absolute -top-1 -right-1 bg-white text-orange-500 text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">4</span>
                      </div>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto space-y-4">
                      <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Video solución</span>
                          <span className="text-[10px] text-slate-400 font-medium">10 mar 2026</span>
                        </div>
                        <h5 className="text-sm font-bold text-slate-800 mb-1">Video instructivo para solucionar el error del método de pago en Meta</h5>
                        <p className="text-xs text-slate-600">La solución para añadir el método de pago a nivel del BM. A continuación el paso a paso...</p>
                      </div>
                      <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Nuevo</span>
                          <span className="text-[10px] text-slate-400 font-medium">20 ene 2026</span>
                        </div>
                        <h5 className="text-sm font-bold text-slate-800 mb-1">Nuevo panel de notificaciones de ventas</h5>
                        <p className="text-xs text-slate-600">Recibe alertas automáticas en WhatsApp cuando se complete una venta o surja una novedad importante.</p>
                      </div>
                    </div>
                  </div>

                  {/* Capacitaciones */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px] overflow-hidden">
                    <div className="bg-primary-container p-4 flex justify-between items-center text-white rounded-t-2xl">
                      <div>
                        <h3 className="font-bold text-lg leading-none">Capacitaciones</h3>
                        <p className="text-xs text-white/80 mt-1">Próximas sesiones importantes</p>
                      </div>
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto space-y-4">
                      <div className="border border-blue-100 rounded-xl p-4 hover:border-primary-container/30 transition-colors">
                        <h5 className="text-sm font-bold text-slate-800 mb-2">Primeros pasos de Chatea PRO</h5>
                        <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">calendar_today</span><span>Todos los días de lunes a viernes</span></div>
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">schedule</span><span>03:00 p.m.</span></div>
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">timer</span><span>Dura: 60 min</span></div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button className="text-primary-container text-xs font-bold flex items-center gap-1 hover:underline">Ingresar <span className="material-symbols-outlined text-xs">open_in_new</span></button>
                        </div>
                      </div>
                      <div className="border border-blue-100 rounded-xl p-4 hover:border-primary-container/30 transition-colors">
                        <h5 className="text-sm font-bold text-slate-800 mb-2">Preguntas y respuestas con Chatea PRO</h5>
                        <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">calendar_today</span><span>Todos los días de lunes a viernes</span></div>
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">schedule</span><span>03:30 p.m.</span></div>
                          <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-xs">timer</span><span>Dura: 50 min</span></div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button className="text-primary-container text-xs font-bold flex items-center gap-1 hover:underline">Ingresar <span className="material-symbols-outlined text-xs">open_in_new</span></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
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
                              const res = await authFetch('/api/panel/add-contact', {
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
                      const res = await authFetch('/api/panel/ai-confidence', { method: 'POST' });
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
                      const res = await authFetch('/api/panel/predictions', { method: 'POST' });
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
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'Last Engagement' : 'Última Interacción'}</th>
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
                                  : (language === 'es' ? 'Última actividad' : 'Last activity')}
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
                            { icon: 'label', iconBg: 'bg-amber-400', color: 'text-white', title: language === 'en' ? 'Segment Updated' : 'Segmento Actualizado', desc: `Status  ${selectedChat.status}`, time: selectedChat.created_at ? new Date(selectedChat.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short' }) : '' },
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'AI Model Selection' : 'Selección de Modelo IA'}</label>
                    <select 
                      className="w-full bg-white border border-slate-100 rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-primary-container/20 appearance-none cursor-pointer"
                      value={configData.model_selection}
                      onChange={e => setConfigData({...configData, model_selection: e.target.value})}
                    >
                      <optgroup label="OpenAI">
                        <option value="gpt-4o">GPT-4o (Recomendado)</option>
                        <option value="gpt-4o-mini">GPT-4o Mini (Rápido)</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Económico)</option>
                      </optgroup>
                      <optgroup label="Google Gemini">
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (Rápido)</option>
                      </optgroup>
                      <optgroup label="Groq (Ultra Rápido)">
                        <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                        <option value="llama-3.1-8b-instant">Llama 3.1 8B (Instant)</option>
                        <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                      </optgroup>
                    </select>
                    <p className="text-[9px] text-slate-400 mt-1">{language === 'en' ? 'Requires the corresponding API key configured above' : 'Requiere la API key del proveedor correspondiente'}</p>
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
              <section className="col-span-12 lg:col-span-5 bg-gradient-to-br from-white to-slate-50/50 rounded-3xl p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                {/* Decorative background accent */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.03]" style={{
                  background: selectedAiProvider === 'openai' ? '#10a37f' : selectedAiProvider === 'gemini' ? '#1a73e8' : '#f55036',
                  transform: 'translate(30%, -30%)',
                }} />

                {/* Header with live status */}
                <div className="flex items-center justify-between mb-7">
                  <div className="flex items-center space-x-3">
                    <div className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all duration-300 ${
                      selectedAiProvider === 'openai' ? 'bg-[#10a37f]/10' :
                      selectedAiProvider === 'gemini' ? 'bg-[#1a73e8]/10' :
                      'bg-[#f55036]/10'
                    }`}>
                      <span className={`material-symbols-outlined text-xl transition-all duration-300 ${
                        selectedAiProvider === 'openai' ? 'text-[#10a37f]' :
                        selectedAiProvider === 'gemini' ? 'text-[#1a73e8]' :
                        'text-[#f55036]'
                      }`} style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold font-headline">{language === 'en' ? 'AI Provider' : 'Proveedor de IA'}</h3>
                      <p className="text-[10px] text-slate-400 font-semibold">{language === 'en' ? 'Select and configure your provider' : 'Seleccione y configure su proveedor'}</p>
                    </div>
                  </div>
                  {/* Always-visible live status badge */}
                  {(() => {
                    const currentKey = selectedAiProvider === 'openai' ? configData.openai_key : selectedAiProvider === 'gemini' ? configData.gemini_key : configData.groq_key;
                    const hasKey = currentKey && currentKey.length > 5;
                    const isOk = aiKeyStatus === 'success';
                    const isErr = aiKeyStatus === 'error';
                    const isPending = hasKey && !isOk && !isErr;
                    return (
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${
                        isOk ? 'bg-emerald-50 border-emerald-200' :
                        isErr ? 'bg-red-50 border-red-200' :
                        isPending ? 'bg-amber-50 border-amber-200' :
                        'bg-slate-50 border-slate-200'
                      }`}>
                        <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          isOk ? 'bg-emerald-500 animate-pulse' :
                          isErr ? 'bg-red-500' :
                          isPending ? 'bg-amber-400 animate-pulse' :
                          'bg-slate-300'
                        }`} />
                        <span className={`text-[9px] font-black uppercase tracking-wider ${
                          isOk ? 'text-emerald-600' :
                          isErr ? 'text-red-600' :
                          isPending ? 'text-amber-600' :
                          'text-slate-400'
                        }`}>
                          {isOk ? (language === 'en' ? 'Active' : 'Activo') :
                           isErr ? 'Error' :
                           isPending ? (language === 'en' ? 'Pending' : 'Pendiente') :
                           'Offline'}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Custom Provider Selector */}
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'en' ? 'Active Provider' : 'Proveedor Activo'}</label>
                    <div className="relative">
                      <select
                        value={selectedAiProvider}
                        onChange={e => { setSelectedAiProvider(e.target.value as any); setAiKeyStatus('idle'); setAiCreditsStatus('idle'); setTimeout(() => handleVerifyAiKey(true), 300); }}
                        className={`w-full bg-white border-2 rounded-2xl text-sm font-bold py-4 pl-12 pr-10 focus:ring-2 appearance-none cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md ${
                          selectedAiProvider === 'openai' ? 'border-[#10a37f]/30 focus:border-[#10a37f] focus:ring-[#10a37f]/20' :
                          selectedAiProvider === 'gemini' ? 'border-[#1a73e8]/30 focus:border-[#1a73e8] focus:ring-[#1a73e8]/20' :
                          'border-[#f55036]/30 focus:border-[#f55036] focus:ring-[#f55036]/20'
                        }`}
                      >
                        <option value="openai">OpenAI (GPT-4o)</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="groq">Groq (Ultra R{'\u00e1'}pido)</option>
                      </select>
                      {/* Icon overlay */}
                      <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
                        selectedAiProvider === 'openai' ? 'bg-[#10a37f]/10' :
                        selectedAiProvider === 'gemini' ? 'bg-[#1a73e8]/10' :
                        'bg-[#f55036]/10'
                      }`}>
                        <span className={`material-symbols-outlined text-sm ${
                          selectedAiProvider === 'openai' ? 'text-[#10a37f]' :
                          selectedAiProvider === 'gemini' ? 'text-[#1a73e8]' :
                          'text-[#f55036]'
                        }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                          {selectedAiProvider === 'openai' ? 'psychology' : selectedAiProvider === 'gemini' ? 'auto_awesome' : 'bolt'}
                        </span>
                      </div>
                      {/* Dropdown arrow */}
                      <span className="material-symbols-outlined text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-base">expand_more</span>
                    </div>
                  </div>

                  {/* API Key Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">API Key</label>
                    <div className="relative group">
                      <input 
                        className={`w-full bg-white border-2 rounded-2xl px-4 py-4 pr-20 text-xs font-mono font-bold text-slate-600 transition-all duration-300 focus:ring-2 shadow-sm group-hover:shadow-md ${
                          aiKeyStatus === 'success' ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-200/40' :
                          aiKeyStatus === 'error' ? 'border-red-300 focus:border-red-400 focus:ring-red-200/40' :
                          'border-slate-200 focus:border-primary-container focus:ring-primary-container/20'
                        }`}
                        type={showAiApiKey ? 'text' : 'password'} 
                        placeholder={selectedAiProvider === 'openai' ? 'sk-proj-...' : selectedAiProvider === 'gemini' ? 'AIzaSy...' : 'gsk_...'}
                        value={selectedAiProvider === 'openai' ? (configData.openai_key || '') : selectedAiProvider === 'gemini' ? (configData.gemini_key || '') : (configData.groq_key || '')}
                        onChange={e => {
                          const key = selectedAiProvider === 'openai' ? 'openai_key' : selectedAiProvider === 'gemini' ? 'gemini_key' : 'groq_key';
                          setConfigData({...configData, [key]: e.target.value});
                          setAiKeyStatus('idle');
                          setAiCreditsStatus('idle');
                        }}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        {aiKeyStatus === 'success' && <span className="material-symbols-outlined text-emerald-500 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                        {aiKeyStatus === 'error' && <span className="material-symbols-outlined text-red-500 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>}
                        <button type="button" onClick={() => setShowAiApiKey(!showAiApiKey)} className="text-slate-400 hover:text-slate-600 transition-colors p-0.5">
                          <span className="material-symbols-outlined text-base">{showAiApiKey ? 'visibility_off' : 'visibility'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Verify Button */}
                  <button 
                    onClick={handleVerifyAiKey}
                    disabled={aiKeyVerifying}
                    className={`w-full py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2.5 shadow-lg ${
                      aiKeyStatus === 'success' 
                        ? 'bg-emerald-500 text-white shadow-emerald-500/25 hover:bg-emerald-600' 
                        : aiKeyStatus === 'error'
                          ? 'bg-red-500 text-white shadow-red-500/25 hover:bg-red-600'
                          : `text-white shadow-slate-900/20 hover:opacity-90 ${
                              selectedAiProvider === 'openai' ? 'bg-gradient-to-r from-[#10a37f] to-[#0d8c6d]' :
                              selectedAiProvider === 'gemini' ? 'bg-gradient-to-r from-[#1a73e8] to-[#1557b0]' :
                              'bg-gradient-to-r from-[#f55036] to-[#d4402a]'
                            }`
                    }`}
                  >
                    {aiKeyVerifying ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {language === 'en' ? 'Verifying...' : 'Verificando...'}</>
                    ) : aiKeyStatus === 'success' ? (
                      <><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span> {language === 'en' ? 'Verified' : 'Verificado'}</>
                    ) : aiKeyStatus === 'error' ? (
                      <><span className="material-symbols-outlined text-sm">refresh</span> {language === 'en' ? 'Retry Verification' : 'Reintentar Verificaci\u00f3n'}</>
                    ) : (
                      <><span className="material-symbols-outlined text-sm">shield</span> {language === 'en' ? 'Verify Connection' : 'Verificar Conexi\u00f3n'}</>
                    )}
                  </button>

                  {/* Status detail message */}
                  {aiKeyStatusMsg && aiKeyStatus !== 'idle' && (
                    <motion.p 
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className={`text-[10px] font-bold text-center ${aiKeyStatus === 'success' ? 'text-emerald-600' : 'text-red-500'}`}
                    >
                      {aiKeyStatusMsg}
                    </motion.p>
                  )}

                  {/* Credits / Status Card */}
                  <div className={`p-4 rounded-2xl border flex items-center gap-3 transition-all duration-300 ${
                    aiCreditsStatus === 'active' ? 'bg-emerald-50/80 border-emerald-200/60' :
                    aiCreditsStatus === 'exhausted' || aiCreditsStatus === 'error' ? 'bg-red-50/80 border-red-200/60' :
                    aiCreditsStatus === 'low' ? 'bg-amber-50/80 border-amber-200/60' :
                    'bg-slate-50/80 border-slate-100'
                  }`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      aiCreditsStatus === 'active' ? 'bg-emerald-100' :
                      aiCreditsStatus === 'exhausted' || aiCreditsStatus === 'error' ? 'bg-red-100' :
                      aiCreditsStatus === 'low' ? 'bg-amber-100' :
                      'bg-slate-100'
                    }`}>
                      <span className={`material-symbols-outlined text-sm ${
                        aiCreditsStatus === 'active' ? 'text-emerald-600' :
                        aiCreditsStatus === 'exhausted' || aiCreditsStatus === 'error' ? 'text-red-600' :
                        aiCreditsStatus === 'low' ? 'text-amber-600' :
                        'text-slate-400'
                      }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {aiCreditsStatus === 'active' ? 'check_circle' :
                         aiCreditsStatus === 'exhausted' || aiCreditsStatus === 'error' ? 'error' :
                         aiCreditsStatus === 'low' ? 'warning' : 'help'}
                      </span>
                    </div>
                    <div>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${
                        aiCreditsStatus === 'active' ? 'text-emerald-700' :
                        aiCreditsStatus === 'exhausted' || aiCreditsStatus === 'error' ? 'text-red-700' :
                        'text-slate-400'
                      }`}>{language === 'en' ? 'AI Status' : 'Estado de IA'}</p>
                      <p className={`text-[10px] font-medium ${
                        aiCreditsStatus === 'active' ? 'text-emerald-600' :
                        aiCreditsStatus === 'exhausted' || aiCreditsStatus === 'error' ? 'text-red-600' :
                        'text-slate-400'
                      }`}>{aiCreditsMsg || (language === 'en' ? 'Click verify to check' : 'Verifique la conexi\u00f3n')}</p>
                    </div>
                  </div>
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
                      : (language === 'en' ? 'Not configured -- will use main number' : 'No configurado -- usar\u00E1 n\u00FAmero principal')}
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

            {/* Sticky Action Bar -- Discard only shows when changes exist, Apply always visible */}
            {(() => {
              const hasChanges = originalConfigRef.current && JSON.stringify(configData) !== JSON.stringify(originalConfigRef.current);
              return (
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
                        {language === 'en' ? 'Parameters synchronized successfully!' : '\u00a1Par\u00e1metros sincronizados con \u00e9xito!'}
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
                    {hasChanges && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={discardChanges}
                        className="px-8 py-4 bg-white text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl hover:bg-slate-50 transition-all active:scale-95 border border-slate-100"
                      >
                        {language === 'en' ? 'Discard Changes' : 'Descartar Cambios'}
                      </motion.button>
                    )}
                  </AnimatePresence>
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
                    {language === 'en' ? 'Apply Parameters' : 'Aplicar Par\u00e1metros'}
                  </button>
                </div>
              );
            })()}
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
                      {kbUploading ? (
                        <span className="text-[9px] font-bold text-amber-500 animate-pulse">
                          {language === 'en' ? 'Uploading...' : 'Subiendo...'}
                        </span>
                      ) : (
                        <button onClick={() => botKbFileRef.current?.click()} className="text-primary-container hover:opacity-70 transition-opacity" title={language === 'en' ? 'Upload file' : 'Subir archivo'}><span className="material-symbols-outlined text-lg">upload_file</span></button>
                      )}
                    </h3>
                    <input ref={botKbFileRef} type="file" accept=".pdf,.csv,.txt" multiple className="hidden" onChange={e => { const files = e.target.files; if (files) { Array.from(files).forEach(f => uploadKBFile(f)); e.target.value = ''; }}} />
                    <div className="space-y-3 overflow-y-auto max-h-48 pr-1 flex-1">
                      {kbLoading && <div className="text-center py-6"><span className="text-[10px] text-slate-400 animate-pulse">{language === 'en' ? 'Loading files...' : 'Cargando archivos...'}</span></div>}
                      {!kbLoading && botKnowledgeFiles.length === 0 && (
                        <div className="text-center py-6">
                          <span className="material-symbols-outlined text-slate-300 text-3xl">folder_open</span>
                          <p className="text-[10px] text-slate-400 mt-2">{language === 'en' ? 'No files uploaded yet' : 'Aún no hay archivos subidos'}</p>
                        </div>
                      )}
                      {botKnowledgeFiles.map((file, idx) => (
                        <div key={file.id || idx} className="p-3 bg-white rounded-xl flex items-center justify-between group shadow-sm border border-slate-50 hover:shadow-md transition-shadow">
                          <div className="flex items-center space-x-3 overflow-hidden flex-1">
                            <span className="material-symbols-outlined text-lg" style={{ color: file.type === 'pdf' ? '#dc2626' : file.type === 'csv' ? '#16a34a' : '#3b82f6' }}>{file.type === 'pdf' ? 'picture_as_pdf' : file.type === 'csv' ? 'table_chart' : 'description'}</span>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-700 truncate block">{file.name}</span>
                              <span className="text-[9px] text-slate-400">{file.size}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => file.id && deleteKBFile(file.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"><span className="material-symbols-outlined text-sm">delete</span></button>
                            <button onClick={() => file.id && toggleKBFile(file.id, !file.active)} className={`w-8 h-4 rounded-full relative transition-colors ${file.active ? 'bg-emerald-500' : 'bg-slate-300'}`}><div className={`absolute top-[2px] w-3 h-3 bg-white rounded-full shadow-sm transition-all ${file.active ? 'right-[2px]' : 'left-[2px]'}`} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Drop zone */}
                    <button onClick={() => botKbFileRef.current?.click()} disabled={kbUploading} className={`mt-4 w-full border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-primary-container/40 hover:bg-primary-container/5 transition-all cursor-pointer group ${kbUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      <span className="material-symbols-outlined text-slate-300 group-hover:text-primary-container text-2xl">{kbUploading ? 'hourglass_top' : 'cloud_upload'}</span>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">{kbUploading ? (language === 'en' ? 'Processing file...' : 'Procesando archivo...') : (language === 'en' ? 'Drop or click to upload PDF, CSV, TXT' : 'Arrastra o haz clic para subir PDF, CSV, TXT')}</p>
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
                        const res = await authFetch('/api/panel/test-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userMsg, history: botPreviewMessages.map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content })), botName, botRole, botTone, temperature: botTemperature, humanHandoff: botHumanHandoff, profanityFilter: botProfanityFilter, topicLocks: botTopicLocks }) });
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
                    const playgroundConfig = { botName, botRole, botTone, botTemperature, botModelSelected, botHumanHandoff, botProfanityFilter, botTopicLocks };
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

        {activeTab === 'campaigns' && (
          <motion.div
            key="campaigns"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Sub-Navigation */}
            <header className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-[#0b1c30] mb-1" style={{ fontFamily: 'Inter' }}>
                    {campaignSubTab === 'campaigns' ? (language === 'en' ? 'Campaigns' : 'Campañas') : campaignSubTab === 'creative' ? 'Creative Lab' : (language === 'en' ? 'Analytics' : 'Analíticas')}
                  </h2>
                  <p className="text-sm text-[#414754]">
                    {campaignSubTab === 'campaigns' 
                      ? (language === 'en' ? 'Manage and monitor your active ad campaigns.' : 'Gestiona y monitorea tus campañas publicitarias activas.')
                      : campaignSubTab === 'creative'
                      ? (language === 'en' ? 'Design and preview your Facebook ads with high-precision AI assistance.' : 'Diseña y previsualiza tus anuncios de Facebook con asistencia de IA.')
                      : (language === 'en' ? 'Track performance metrics across all your campaigns.' : 'Rastrea las metricas de rendimiento de todas tus campañas.')}
                  </p>
                </div>
                {campaignSubTab === 'campaigns' && (
                  <button onClick={() => setCampaignSubTab('creative')} className="px-5 py-2.5 text-white font-semibold rounded-lg shadow-lg text-sm flex items-center gap-2 hover:opacity-90 transition-all" style={{ background: 'linear-gradient(135deg, #1877F2 0%, #054ADA 100%)' }}>
                    <span className="material-symbols-outlined text-sm">add</span>
                    {language === 'en' ? 'New Campaign' : 'Nueva Campaña'}
                  </button>
                )}
              </div>
              <nav className="flex gap-1 bg-[#eff4ff] p-1 rounded-xl border border-[#c1c6d6]">
                {([
                  { key: 'campaigns' as const, icon: 'campaign', label: language === 'en' ? 'Campaigns' : 'Campañas' },
                  { key: 'creative' as const, icon: 'brush', label: 'Creative Lab' },
                  { key: 'analytics' as const, icon: 'monitoring', label: language === 'en' ? 'Analytics' : 'Analíticas' },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setCampaignSubTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                      campaignSubTab === tab.key
                        ? 'bg-white text-[#0b1c30] shadow-sm border border-[#c1c6d6]'
                        : 'text-[#414754] hover:text-[#0b1c30] hover:bg-white/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </header>

            {/* ===== SUB-TAB: CAMPAIGNS OVERVIEW ===== */}
            {campaignSubTab === 'campaigns' && (
              <div className="space-y-6">
                {/* Load from Facebook + Filters */}
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => loadFbCampaigns()} disabled={fbLoading} className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-lg text-sm disabled:opacity-50 hover:opacity-90 transition-opacity" style={{ background: 'linear-gradient(135deg, #1877F2 0%, #054ADA 100%)' }}>
                    <span className="material-symbols-outlined text-sm">{fbLoading ? 'sync' : 'cloud_download'}</span>
                    {fbLoading ? (language === 'en' ? 'Loading...' : 'Cargando...') : (language === 'en' ? 'Load from Facebook' : 'Cargar de Facebook')}
                  </button>
                  {fbError && <span className="text-sm text-red-600 bg-red-50 px-3 py-1 rounded-lg">{fbError}</span>}
                  {fbCampaigns.length > 0 && <span className="text-sm text-[#006947] bg-[#006947]/10 px-3 py-1 rounded-lg font-semibold">{fbCampaigns.length} {language === 'en' ? 'campaigns loaded' : 'campañas cargadas'}</span>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white border border-[#c1c6d6] rounded-lg px-3 py-2" style={{ boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' }}>
                      <span className="text-[12px] font-semibold text-[#414754] mr-2 uppercase tracking-wider">{language === 'en' ? 'Status:' : 'Estado:'}</span>
                      <select className="bg-transparent border-none text-sm font-semibold focus:ring-0 cursor-pointer text-[#0b1c30]">
                        <option>{language === 'en' ? 'All' : 'Todos'}</option>
                        <option>{language === 'en' ? 'Active' : 'Activas'}</option>
                        <option>{language === 'en' ? 'Paused' : 'Pausadas'}</option>
                      </select>
                    </div>
                  </div>
                  <button className="flex items-center gap-2 text-[#0058bc] font-semibold hover:bg-[#0058bc]/5 px-4 py-2 rounded-lg transition-colors">
                    <span className="material-symbols-outlined">filter_list</span>
                    {language === 'en' ? 'Advanced Filters' : 'Filtros Avanzados'}
                  </button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: language === 'en' ? 'Total Campaigns' : 'Total Campañas', value: String(fbCampaigns.length || 0), trend: 'Facebook Ads', trendIcon: 'campaign', trendColor: 'text-[#006947]' },
                    { label: language === 'en' ? 'Total Spent' : 'Gasto Total', value: '$' + fbCampaigns.reduce((s:number,c:any) => s + parseFloat(c.insights?.spend||'0'), 0).toFixed(2), trend: fbCampaigns.length > 0 ? 'Datos reales' : 'Carga campañas', pacing: fbCampaigns.length > 0 ? 100 : 0 },
                    { label: language === 'en' ? 'Average CPC' : 'CPC Promedio', value: '$' + (fbCampaigns.length > 0 ? (fbCampaigns.reduce((s:number,c:any) => s + parseFloat(c.insights?.cpc||'0'), 0) / fbCampaigns.length).toFixed(2) : '0.00'), trend: 'Facebook API', trendIcon: 'trending_up', trendColor: 'text-[#006947]' },
                    { label: language === 'en' ? 'Total Clicks' : 'Total Clicks', value: String(fbCampaigns.reduce((s:number,c:any) => s + parseInt(c.insights?.clicks||'0'), 0)), trend: 'Real-time', trendIcon: 'trending_up', trendColor: 'text-[#006947]' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white p-6 rounded-lg border border-[#c1c6d6] hover:border-[#0058bc] transition-colors" style={{ boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' }}>
                      <p className="text-[12px] font-semibold text-[#414754] mb-1 uppercase tracking-wider">{s.label}</p>
                      <h3 className="text-3xl font-bold text-[#0b1c30] tracking-tight">{s.value}</h3>
                      <div className="mt-4 flex items-center gap-1">
                        {s.trendIcon && <span className={`material-symbols-outlined text-[16px] ${s.trendColor}`}>{s.trendIcon}</span>}
                        <span className={`text-[12px] font-semibold ${s.trendColor || 'text-[#414754]'}`}>{s.trend}</span>
                        {s.pacing && (
                          <div className="ml-2 w-full h-1.5 bg-[#e5eeff] rounded-full overflow-hidden">
                            <div className="h-full bg-[#0058bc] rounded-full" style={{ width: s.pacing + '%' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Campaigns Table */}
                <div className="bg-white rounded-lg border border-[#c1c6d6] overflow-hidden" style={{ boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' }}>
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#eff4ff] border-b border-[#c1c6d6]">
                      <tr>
                        <th className="px-6 py-4 text-[12px] text-[#414754] font-bold uppercase tracking-wider">{language === 'en' ? 'Campaign' : 'Campaña'}</th>
                        <th className="px-6 py-4 text-[12px] text-[#414754] font-bold uppercase tracking-wider">{language === 'en' ? 'Status' : 'Estado'}</th>
                        <th className="px-6 py-4 text-[12px] text-[#414754] font-bold uppercase tracking-wider">{language === 'en' ? 'Budget' : 'Presupuesto'}</th>
                        <th className="px-6 py-4 text-[12px] text-[#414754] font-bold uppercase tracking-wider text-right">{language === 'en' ? 'Results' : 'Resultados'}</th>
                        <th className="px-6 py-4 text-[12px] text-[#414754] font-bold uppercase tracking-wider text-right">{language === 'en' ? 'Cost/Res' : 'Costo/Res'}</th>
                        <th className="px-6 py-4 text-[12px] text-[#414754] font-bold uppercase tracking-wider">{language === 'en' ? 'Date' : 'Fecha'}</th>
                        <th className="px-6 py-4 text-[12px] text-[#414754] font-bold uppercase tracking-wider text-right">{language === 'en' ? 'Actions' : 'Acciones'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c1c6d6]">
                      {(fbCampaigns.length > 0 ? fbCampaigns.map((c:any) => ({
  name: c.name || 'Sin nombre', platform: 'Facebook', category: c.objective || 'TRAFFIC', status: c.status === 'ACTIVE' ? 'active' : 'paused', budgetDay: '$' + (c.daily_budget || '0.00'), budgetTotal: '$' + (c.lifetime_budget || '--'), resultValue: c.insights?.impressions || '0', resultLabel: language === 'en' ? 'Impressions' : 'Impresiones', costValue: '$' + (c.insights?.cpc || '0.00'), costLabel: 'CPC', date: c.created_time ? new Date(c.created_time).toLocaleDateString() : '--', img: 'campaign', id: c.id, rawStatus: c.status,
})) : [
  { name: language === 'en' ? 'No campaigns loaded' : 'Sin campañas cargadas', platform: 'Facebook', category: '--', status: 'paused', budgetDay: '--', budgetTotal: '--', resultValue: '--', resultLabel: '--', costValue: '--', costLabel: '--', date: '--', img: 'info', id: '', rawStatus: '' },
]).map((row, i) => (
                        <tr key={i} className="hover:bg-[#f8f9ff] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded bg-[#dce9ff] overflow-hidden flex-shrink-0 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[#0058bc]">{row.img}</span>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-[#0b1c30]">{row.name}</p>
                                <p className="text-[11px] text-[#414754]">{row.platform} · {row.category}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${row.status === 'active' ? 'bg-[#6ffbbe]/30 text-[#005236]' : 'bg-[#dce9ff] text-[#414754]'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'active' ? 'bg-[#006947]' : 'bg-[#727785]'}`} />
                              {row.status === 'active' ? (language === 'en' ? 'Active' : 'Activa') : (language === 'en' ? 'Paused' : 'Pausada')}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-[#0b1c30]">{row.budgetDay}/{language === 'en' ? 'day' : 'dia'}</p>
                            <p className="text-[11px] text-[#414754]">Total: {row.budgetTotal}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-sm font-bold">{row.resultValue}</p>
                            <p className="text-[11px] text-[#414754]">{row.resultLabel}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-sm font-bold text-[#0058bc]">{row.costValue}</p>
                            <p className="text-[11px] text-[#414754]">{row.costLabel}</p>
                          </td>
                          <td className="px-6 py-4"><p className="text-sm">{row.date}</p></td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button className="p-2 text-[#414754] hover:text-[#0058bc] hover:bg-[#0058bc]/10 rounded transition-colors" onClick={() => setCampaignSubTab('creative')}><span className="material-symbols-outlined text-lg">edit</span></button>
                              <button className="p-2 text-[#414754] hover:text-[#006947] hover:bg-[#006947]/10 rounded transition-colors" onClick={() => row.id && toggleFbCampaign(row.id, row.rawStatus || 'PAUSED')}><span className="material-symbols-outlined text-lg">{row.status === 'active' ? 'pause' : 'play_arrow'}</span></button>
                              <button className="p-2 text-[#414754] hover:text-[#ba1a1a] hover:bg-[#ba1a1a]/10 rounded transition-colors" onClick={() => row.id && deleteFbCampaign(row.id)}><span className="material-symbols-outlined text-lg">delete</span></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Pagination */}
                  <div className="bg-[#eff4ff] px-6 py-4 flex items-center justify-between border-t border-[#c1c6d6]">
                    <p className="text-[12px] font-semibold text-[#414754]">{language === 'en' ? `Showing ${fbCampaigns.length} campaigns from Facebook` : `Mostrando ${fbCampaigns.length} campañas de Facebook`}</p>
                    <div className="flex items-center gap-2">
                      <button className="p-1 rounded hover:bg-[#dce9ff] transition-colors disabled:opacity-50" disabled><span className="material-symbols-outlined">chevron_left</span></button>
                      <div className="flex items-center gap-1">
                        <button className="w-8 h-8 rounded bg-[#0058bc] text-white font-bold text-[12px]">1</button>
                        <button className="w-8 h-8 rounded hover:bg-[#dce9ff] transition-colors text-[12px]">2</button>
                        <button className="w-8 h-8 rounded hover:bg-[#dce9ff] transition-colors text-[12px]">3</button>
                      </div>
                      <button className="p-1 rounded hover:bg-[#dce9ff] transition-colors"><span className="material-symbols-outlined">chevron_right</span></button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== SUB-TAB: CREATIVE LAB ===== */}
            {campaignSubTab === 'creative' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Ad Creation Form */}
              <div className="lg:col-span-7 space-y-6">
                <section className="bg-white rounded-xl border border-[#c1c6d6] p-6" style={{ boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' }}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-[#0b1c30]">{language === 'en' ? 'Create New Ad' : 'Crear Nuevo Anuncio'}</h3>
                    <span className="bg-[#00855b] text-white px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide">RIFX AdGenius</span>
                  </div>

                  {/* Title */}
                  <div className="mb-5">
                    <label className="block text-[12px] font-semibold text-[#414754] mb-2 uppercase tracking-widest">{language === 'en' ? 'Ad Title' : 'Titulo del Anuncio'}</label>
                    <input type="text" value={campaignTitle} onChange={e => setCampaignTitle(e.target.value.slice(0,80))} placeholder={language === 'en' ? 'Ex: Summer Sale 50% Off' : 'Ej: Rebajas de Verano 50% Descuento'} className="w-full p-3 bg-[#eff4ff] border border-[#c1c6d6] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#0058bc] focus:border-[#0058bc] outline-none transition-all" />
                  </div>

                  {/* Dual Image Upload */}
                  <div className="mb-5">
                    <label className="block text-[12px] font-semibold text-[#414754] mb-2 uppercase tracking-widest">{language === 'en' ? 'Images' : 'Imagenes'}</label>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Reference Banner */}
                      <div>
                        <p className="text-[11px] font-semibold text-[#0058bc] mb-1.5 flex items-center gap-1"><span className="material-symbols-outlined text-sm">photo_library</span> {language === 'en' ? 'Reference Banner' : 'Pancarta de Referencia'}</p>
                        <input type="file" accept="image/*" className="hidden" ref={campaignFileRef} onChange={handleCampaignImageUpload} />
                        {campaignImagePreview ? (
                          <div className="relative w-full h-40 rounded-xl overflow-hidden group border-2 border-[#0058bc]/30">
                            <img src={campaignImagePreview} alt="Ref" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                              <button onClick={() => campaignFileRef.current?.click()} className="px-3 py-1.5 bg-white text-[#0b1c30] font-semibold text-[11px] rounded-lg shadow-lg">{language === 'en' ? 'Change' : 'Cambiar'}</button>
                              <button onClick={() => { setCampaignImage(null); setCampaignImagePreview(null); }} className="px-3 py-1.5 bg-red-500 text-white font-semibold text-[11px] rounded-lg shadow-lg">{language === 'en' ? 'Remove' : 'Quitar'}</button>
                            </div>
                            <div className="absolute top-2 left-2 bg-[#0058bc] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">REF</div>
                          </div>
                        ) : (
                          <div onClick={() => campaignFileRef.current?.click()} className="border-2 border-dashed border-[#c1c6d6] rounded-xl bg-[#eff4ff] p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-[#dce9ff] hover:border-[#0058bc] transition-all h-40">
                            <span className="material-symbols-outlined text-[#0058bc] text-3xl mb-2">image</span>
                            <p className="text-[11px] font-semibold text-center">{language === 'en' ? 'Upload reference banner' : 'Sube la pancarta de ejemplo'}</p>
                            <p className="text-[10px] text-[#414754] mt-1">{language === 'en' ? 'The AI will analyze its layout' : 'La IA analizara su diseño'}</p>
                          </div>
                        )}
                      </div>
                      {/* Product Image */}
                      <div>
                        <p className="text-[11px] font-semibold text-[#006947] mb-1.5 flex items-center gap-1"><span className="material-symbols-outlined text-sm">shopping_bag</span> {language === 'en' ? 'Product Image' : 'Imagen del Producto'}</p>
                        <input type="file" accept="image/*" className="hidden" ref={productFileRef} onChange={handleProductImageUpload} />
                        {productImagePreview ? (
                          <div className="relative w-full h-40 rounded-xl overflow-hidden group border-2 border-[#006947]/30">
                            <img src={productImagePreview} alt="Product" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                              <button onClick={() => productFileRef.current?.click()} className="px-3 py-1.5 bg-white text-[#0b1c30] font-semibold text-[11px] rounded-lg shadow-lg">{language === 'en' ? 'Change' : 'Cambiar'}</button>
                              <button onClick={() => { setProductImage(null); setProductImagePreview(null); }} className="px-3 py-1.5 bg-red-500 text-white font-semibold text-[11px] rounded-lg shadow-lg">{language === 'en' ? 'Remove' : 'Quitar'}</button>
                            </div>
                            <div className="absolute top-2 left-2 bg-[#006947] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">PROD</div>
                          </div>
                        ) : (
                          <div onClick={() => productFileRef.current?.click()} className="border-2 border-dashed border-[#c1c6d6] rounded-xl bg-[#f0fff4] p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-[#dcfce7] hover:border-[#006947] transition-all h-40">
                            <span className="material-symbols-outlined text-[#006947] text-3xl mb-2">add_photo_alternate</span>
                            <p className="text-[11px] font-semibold text-center">{language === 'en' ? 'Upload product photo' : 'Sube la foto del producto'}</p>
                            <p className="text-[10px] text-[#414754] mt-1">{language === 'en' ? 'Will be used in the final ad' : 'Se usara en el anuncio final'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description Section */}
                  <div className="mb-5">
                    <label className="block text-[12px] font-semibold text-[#414754] mb-2 uppercase tracking-widest">{language === 'en' ? 'Product Description' : 'Descripcion del Producto'}</label>
                    <textarea
                      value={campaignDesc}
                      onChange={e => setCampaignDesc(e.target.value.slice(0, 500))}
                      placeholder={language === 'en' ? 'Describe your product or service in detail...' : 'Describe tu producto o servicio en detalle...'}
                      className="w-full h-28 p-4 bg-[#eff4ff] border border-[#c1c6d6] rounded-xl text-sm focus:ring-2 focus:ring-[#0058bc] focus:border-[#0058bc] outline-none transition-all resize-none"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-[#414754]">{campaignDesc.length}/500</span>
                      <span className="text-[10px] text-[#414754]">{language === 'en' ? 'The more detail, the better the AI result' : 'Mientras mas detalles, mejor resultado de la IA'}</span>
                    </div>
                  </div>

                  {/* Daily Budget */}
                  <div className="mb-6">
                    <label className="block text-[12px] font-semibold text-[#414754] mb-2 uppercase tracking-widest">{language === 'en' ? 'Daily Budget' : 'Presupuesto Diario'}</label>
                    <div className="flex items-center gap-4 p-4 bg-[#eff4ff] rounded-xl border border-[#c1c6d6]">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-[#0b1c30]">${dailyBudget}</span>
                        <span className="text-sm text-[#414754]">/dia</span>
                      </div>
                      <input type="range" min={1} max={100} value={dailyBudget} onChange={e => setDailyBudget(Number(e.target.value))} className="flex-1 h-2 bg-[#c1c6d6] rounded-lg appearance-none cursor-pointer accent-[#0058bc]" />
                      <input type="number" min={1} max={1000} value={dailyBudget} onChange={e => setDailyBudget(Math.max(1, Math.min(1000, Number(e.target.value))))} className="w-20 p-2 bg-white border border-[#c1c6d6] rounded-lg text-sm text-center font-semibold focus:ring-2 focus:ring-[#0058bc] outline-none" />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-[#414754]">{language === 'en' ? 'Monthly estimate' : 'Estimado mensual'}: ${(dailyBudget * 30).toLocaleString()}</span>
                      {campaignResult?.campaign_config?.daily_budget_usd && <span className="text-[10px] text-[#0058bc] font-semibold">IA sugiere: ${campaignResult.campaign_config.daily_budget_usd}/dia</span>}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-5 border-t border-[#c1c6d6] flex flex-wrap justify-end gap-3">
                    <button onClick={() => { setCampaignDesc(''); setCampaignTitle(''); setCampaignImage(null); setCampaignImagePreview(null); setProductImage(null); setProductImagePreview(null); setCampaignResult(null); setDailyBudget(5); setGeneratedBanner(null); }} className="px-5 py-2.5 border border-[#727785] text-[#0b1c30] font-semibold rounded-lg hover:bg-[#dce9ff] transition-colors text-sm">{language === 'en' ? 'Clear All' : 'Limpiar Todo'}</button>
                    <button onClick={handleGenerateCampaign} disabled={(!campaignDesc && !campaignTitle) || isGeneratingCampaign} className="px-5 py-2.5 border border-[#0058bc] text-[#0058bc] font-semibold rounded-lg hover:bg-[#0058bc]/5 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                      {isGeneratingCampaign ? (language === 'en' ? 'AdGenius working...' : 'AdGenius trabajando...') : (language === 'en' ? 'Generate with AI' : 'Generar con IA')}
                    </button>
                    <button onClick={publishToFacebook} disabled={fbPublishing || (!campaignResult && !campaignDesc)} className="px-8 py-2.5 text-white font-semibold rounded-lg shadow-lg hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #1877F2 0%, #054ADA 100%)' }}>
                      <span className="material-symbols-outlined text-sm">{fbPublishing ? 'sync' : 'publish'}</span>
                      {fbPublishing ? (language === 'en' ? 'Publishing...' : 'Publicando...') : (language === 'en' ? 'Publish to Facebook' : 'Publicar en Facebook')} · ${dailyBudget}/dia
                    </button>
                  </div>
                </section>

                {/* AdGenius AI Results */}
                <section className="bg-white rounded-xl border border-[#c1c6d6] p-6" style={{ boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[#0058bc]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    <h4 className="text-xl font-semibold">RIFX AdGenius</h4>
                    {campaignResult?.copy_framework && <span className="bg-[#0058bc]/10 text-[#0058bc] text-[10px] font-bold px-2 py-0.5 rounded-full">{campaignResult.copy_framework}</span>}
                  </div>

                  {!campaignResult ? (
                    <div className="text-center py-8 text-[#414754]">
                      <span className="material-symbols-outlined text-4xl text-[#c1c6d6] block mb-2">psychology</span>
                      <p className="text-sm">{language === 'en' ? 'Generate content with AI to see professional recommendations' : 'Genera contenido con IA para ver recomendaciones profesionales'}</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Hook Variants for A/B Testing */}
                      {campaignResult.hook_variants?.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-2">Hooks para A/B Testing</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {campaignResult.hook_variants.map((h: string, i: number) => (
                              <div key={i} className="flex items-center gap-2 p-2.5 bg-[#eff4ff] rounded-lg border border-[#c1c6d6] cursor-pointer hover:border-[#0058bc] transition-colors" onClick={() => setCampaignDesc(h)}>
                                <span className="text-[10px] font-bold text-white bg-[#0058bc] w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">{String.fromCharCode(65+i)}</span>
                                <span className="text-sm">{h}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Audience + Config Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Target Audience */}
                        {campaignResult.target_audience && (
                          <div className="p-4 bg-[#eff4ff] rounded-lg">
                            <p className="text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-sm">people</span> Audiencia Sugerida</p>
                            <div className="space-y-1.5 text-sm">
                              <p><span className="font-semibold">Edad:</span> {campaignResult.target_audience.age_min} - {campaignResult.target_audience.age_max} {language === 'en' ? 'years' : 'años'}</p>
                              <p><span className="font-semibold">Género:</span> {campaignResult.target_audience.gender === 'all' ? 'Todos' : campaignResult.target_audience.gender}</p>
                              {campaignResult.target_audience.interests?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {campaignResult.target_audience.interests.map((int: string, i: number) => (
                                    <span key={i} className="bg-white text-[#0058bc] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#0058bc]/20">{int}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Campaign Config */}
                        {campaignResult.campaign_config && (
                          <div className="p-4 bg-[#eff4ff] rounded-lg">
                            <p className="text-[11px] font-bold text-[#414754] uppercase tracking-wider mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-sm">tune</span> Config. Recomendada</p>
                            <div className="space-y-1.5 text-sm">
                              <p><span className="font-semibold">Objetivo:</span> {campaignResult.campaign_config.objective?.replace('OUTCOME_', '')}</p>
                              <p><span className="font-semibold">Presupuesto:</span> ${campaignResult.campaign_config.daily_budget_usd}/dia</p>
                              <p><span className="font-semibold">Formato:</span> {campaignResult.campaign_config.ad_format}</p>
                              <p><span className="font-semibold">Placement:</span> {campaignResult.campaign_config.placement_recommendation}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Emotional Triggers + A/B Suggestion */}
                      <div className="flex flex-wrap gap-4">
                        {campaignResult.emotional_triggers?.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[#414754] uppercase">Gatillos:</span>
                            {campaignResult.emotional_triggers.map((t: string, i: number) => (
                              <span key={i} className="bg-[#006947]/10 text-[#006947] text-[10px] font-semibold px-2.5 py-1 rounded-full">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {campaignResult.a_b_test_suggestion && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                          <span className="material-symbols-outlined text-yellow-600 text-sm mt-0.5">lightbulb</span>
                          <p className="text-[12px] text-yellow-800"><span className="font-bold">A/B Test:</span> {campaignResult.a_b_test_suggestion}</p>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>

              {/* Right Column: Live Preview - Facebook Phone Mockup */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-xl border border-[#c1c6d6] p-6 sticky top-24" style={{ boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' }}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-[#0b1c30]">{language === 'en' ? 'Real-Time Preview' : 'Vista Previa en Tiempo Real'}</h3>
                    <div className="flex gap-2">
                      <button className="p-2 rounded-lg bg-[#d2e0fe] text-[#55637d]"><span className="material-symbols-outlined text-lg">smartphone</span></button>
                      <button className="p-2 rounded-lg text-[#414754] hover:bg-[#dce9ff] transition-colors"><span className="material-symbols-outlined text-lg">desktop_windows</span></button>
                    </div>
                  </div>

                  {/* Mobile Mockup */}
                  <div className="relative mx-auto w-[300px] bg-[#213145] rounded-[36px] p-3 shadow-2xl border-4 border-[#727785]" style={{ aspectRatio: '9/18.5' }}>
                    <div className="w-full h-full bg-white rounded-[28px] overflow-hidden flex flex-col relative">
                      {/* Facebook Header */}
                      <div className="px-3 py-2.5 border-b border-[#e5eeff] flex items-center justify-between shrink-0">
                        <h5 className="text-[#1877F2] font-bold text-lg tracking-tight">facebook</h5>
                        <div className="flex gap-3">
                          <span className="material-symbols-outlined text-[#414754] text-lg">search</span>
                          <span className="material-symbols-outlined text-[#414754] text-lg">menu</span>
                        </div>
                      </div>

                      {/* Feed */}
                      <div className="flex-1 overflow-y-auto bg-[#F0F2F5]" style={{ scrollbarWidth: 'none' }}>
                        <div className="bg-white mt-2 pb-2">
                          {/* Post Header */}
                          <div className="flex items-center px-3 py-2.5 justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 bg-[#0070eb] rounded-full flex items-center justify-center text-white font-bold text-xs">R</div>
                              <div>
                                <p className="text-[12px] font-bold text-[#0b1c30] flex items-center gap-1">{tenantData?.company || 'RIFX'} <span className="material-symbols-outlined text-[12px] text-[#0058bc]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span></p>
                                <p className="text-[10px] text-[#414754]">{language === 'en' ? 'Sponsored' : 'Publicidad'} · 1h · <span className="material-symbols-outlined text-[8px]">public</span></p>
                              </div>
                            </div>
                            <span className="material-symbols-outlined text-[#414754] text-lg">more_horiz</span>
                          </div>

                          {/* Ad Copy */}
                          <div className="px-3 pb-2">
                            <p className="text-[13px] text-[#0b1c30] leading-snug">{campaignResult ? campaignResult.caption : (campaignDesc || (language === 'en' ? 'Your ad copy will appear here...' : 'El copy de tu anuncio aparecerá aquí...'))}</p>
                            {campaignResult && <p className="text-[#0058bc] text-[12px] mt-1">{campaignResult.hashtags}</p>}
                          </div>

                          {/* Ad Image */}
                          <div className="w-full aspect-square bg-[#dce9ff] relative overflow-hidden">
                            {isGeneratingBanner ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0058bc] to-[#1877F2]">
                                <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
                                <p className="text-white font-semibold text-sm">{language === 'en' ? 'AI generating banner...' : 'IA generando pancarta...'}</p>
                                <p className="text-white/70 text-[10px] mt-1">Pollinations AI + FLUX</p>
                              </div>
                            ) : generatedBanner ? (
                              <img src={generatedBanner} className="w-full h-full object-cover" alt="Generated Banner" />
                            ) : productImagePreview ? (
                              <img src={productImagePreview} className="w-full h-full object-cover" alt="Product" />
                            ) : campaignImagePreview ? (
                              <img src={campaignImagePreview} className="w-full h-full object-cover" alt="Ref" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-white/90 backdrop-blur p-4 rounded-lg shadow-sm border border-white text-center">
                                  <span className="material-symbols-outlined text-[#0058bc] text-2xl block mb-1">auto_awesome</span>
                                  <p className="text-[11px] font-bold text-[#0b1c30]">{language === 'en' ? 'Banner will be generated' : 'El banner se generara'}</p>
                                  <p className="text-[9px] text-[#414754]">{language === 'en' ? 'after AI generation' : 'despues de generar con IA'}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* CTA Bar */}
                          <div className="px-3 py-2.5 bg-white flex items-center justify-between border-t border-[#e5eeff]">
                            <div>
                              <p className="text-[10px] text-[#414754] uppercase tracking-tighter">{tenantData?.company || 'RIFX'}</p>
                              <p className="text-[11px] font-bold">{campaignResult?.hook || (language === 'en' ? 'Power your ads with AI' : 'Potencia tus anuncios con IA')}</p>
                            </div>
                            <button className="bg-[#dce9ff] text-[#0b1c30] font-bold py-1 px-3 rounded text-[11px]">{language === 'en' ? 'Learn more' : 'Más información'}</button>
                          </div>

                          {/* Engagement */}
                          <div className="px-3 py-2 flex items-center justify-between border-t border-[#e5eeff]">
                            <div className="flex items-center gap-1">
                              <div className="flex -space-x-1">
                                <span className="w-4 h-4 bg-[#0058bc] rounded-full flex items-center justify-center border border-white"><span className="material-symbols-outlined text-[9px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>thumb_up</span></span>
                                <span className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border border-white"><span className="material-symbols-outlined text-[9px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span></span>
                              </div>
                              <span className="text-[10px] text-[#414754] ml-1">128</span>
                            </div>
                            <span className="text-[10px] text-[#414754]">12 {language === 'en' ? 'comments' : 'comentarios'} · 8 {language === 'en' ? 'shares' : 'compartidos'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Mobile Nav */}
                      <div className="h-10 bg-white border-t border-[#e5eeff] flex items-center justify-around shrink-0">
                        <span className="material-symbols-outlined text-[#1877F2] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
                        <span className="material-symbols-outlined text-[#414754] text-lg">ondemand_video</span>
                        <span className="material-symbols-outlined text-[#414754] text-lg">store</span>
                        <span className="material-symbols-outlined text-[#414754] text-lg">notifications</span>
                        <span className="material-symbols-outlined text-[#414754] text-lg">menu</span>
                      </div>
                      <div className="h-5 flex items-center justify-center shrink-0"><div className="w-28 h-1 bg-[#414754]/20 rounded-full"></div></div>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#414754] text-center mt-6">{language === 'en' ? 'Preview may vary slightly on the end user device.' : 'La visualizacion puede variar ligeramente segun el dispositivo del usuario final.'}</p>
                  {generatedBanner && (
                    <div className="mt-4 space-y-3">
                      <div className="flex gap-2 justify-center">
                        <a href={generatedBanner} download="rifx-banner-1080x1080.png" className="px-4 py-2 bg-[#0058bc] text-white text-[11px] font-semibold rounded-lg hover:bg-[#054ADA] transition-colors flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">download</span> {language === 'en' ? 'Download Banner' : 'Descargar Banner'}
                        </a>
                        <button onClick={() => generateBannerImage(campaignResult)} className="px-4 py-2 border border-[#0058bc] text-[#0058bc] text-[11px] font-semibold rounded-lg hover:bg-[#0058bc]/5 transition-colors flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">refresh</span> {language === 'en' ? 'Regenerate' : 'Regenerar'}
                        </button>
                      </div>
                      <div className="bg-[#eff4ff] rounded-lg p-3 text-center">
                        <p className="text-[10px] font-bold text-[#414754] uppercase">Calificacion IA del Banner</p>
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <span className="text-2xl font-bold text-[#006947]">{campaignResult ? '8.5' : '--'}/10</span>
                          <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <span key={s} className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1", color: s <= 4 ? '#FFD700' : '#c1c6d6' }}>star</span>)}</div>
                        </div>
                        <p className="text-[9px] text-[#414754] mt-1">{language === 'en' ? 'Score based on composition, contrast and readability' : 'Puntuacion basada en composicion, contraste y legibilidad'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            )}

            {/* ===== SUB-TAB: ANALYTICS ===== */}
            {campaignSubTab === 'analytics' && (
              <div className="space-y-6">
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#c1c6d6]" style={{ boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' }}>
                  <div>
                    <h3 className="text-2xl font-semibold text-[#0b1c30]">{language === 'en' ? 'Performance Summary' : 'Resumen de Rendimiento'}</h3>
                    <p className="text-sm text-[#414754]">{fbInsights ? (language === 'en' ? 'Live data from Facebook API' : 'Datos en vivo de Facebook API') : (language === 'en' ? 'Click Load to fetch real data' : 'Haz clic en Cargar para datos reales')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-[#eff4ff] border border-[#c1c6d6] rounded-lg px-4 py-2 gap-3">
                      <span className="material-symbols-outlined text-[#414754]">calendar_today</span>
                      <span className="text-sm font-medium">1 Oct - 31 Oct, 2024</span>
                      <span className="material-symbols-outlined text-[#414754]">expand_more</span>
                    </div>
                    <button onClick={() => loadFbInsights()} disabled={fbLoading} className="px-5 py-2 text-white font-semibold rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity" style={{ background: 'linear-gradient(135deg, #1877F2 0%, #054ADA 100%)' }}>
                      <span className="material-symbols-outlined text-sm">{fbLoading ? 'sync' : 'cloud_download'}</span>
                      {fbLoading ? (language === 'en' ? 'Loading...' : 'Cargando...') : (language === 'en' ? 'Load from Facebook' : 'Cargar de Facebook')}
                    </button>
                    <button className="bg-white border border-[#c1c6d6] text-[#0b1c30] px-6 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-[#eff4ff] transition-colors">
                      <span className="material-symbols-outlined">download</span>
                      {language === 'en' ? 'Export' : 'Exportar'}
                    </button>
                  </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'ROAS Total', value: (fbInsights?.kpis?.roas || '0.00') + 'x', change: fbInsights ? 'Facebook API' : '--', positive: true, bars: [40,60,50,70,90,85] },
                    { label: language === 'en' ? 'Total Spend' : 'Gasto Total', value: '$' + (fbInsights?.kpis?.spend || '0.00'), change: fbInsights ? (language === 'en' ? 'Real data' : 'Datos reales') : '--', positive: true, bars: [30,50,40,80,70,100] },
                    { label: language === 'en' ? 'Average CPA' : 'CPA Promedio', value: '$' + (fbInsights?.kpis?.cpa || '0.00'), change: fbInsights ? 'CPC: $' + (fbInsights?.kpis?.cpc || '0.00') : '--', positive: false, bars: [80,70,90,60,50,40] },
                    { label: 'CTR Global', value: (fbInsights?.kpis?.ctr || '0.00') + '%', change: fbInsights ? (fbInsights?.kpis?.clicks || '0') + ' clicks' : '--', positive: true, bars: [40,45,55,60,65,70] },
                  ].map((kpi, i) => (
                    <div key={i} className="bg-white p-6 rounded-xl border border-[#c1c6d6] flex flex-col gap-4" style={{ boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' }}>
                      <div className="flex justify-between items-start">
                        <span className="text-[12px] font-semibold text-[#414754] uppercase tracking-wider">{kpi.label}</span>
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded ${kpi.positive ? 'text-[#006947] bg-[#006947]/10' : 'text-[#ba1a1a] bg-[#ba1a1a]/10'}`}>{kpi.change}</span>
                      </div>
                      <div>
                        <span className="text-3xl font-bold text-[#0b1c30] tracking-tight">{kpi.value}</span>
                        <div className="h-8 w-full mt-2 rounded-lg flex items-end" style={{ backgroundColor: kpi.positive ? 'rgba(0,88,188,0.05)' : 'rgba(186,26,26,0.05)' }}>
                          <div className="w-full flex items-baseline gap-[2px] px-1">
                            {kpi.bars.map((h, j) => (
                              <div key={j} className="w-full rounded-t-sm" style={{ height: h+'%', backgroundColor: kpi.positive ? `rgba(0,88,188,${0.2 + j*0.15})` : `rgba(186,26,26,${0.2 + j*0.15})` }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bento: Chart + AI Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Performance Chart */}
                  <div className="lg:col-span-8 bg-white p-6 rounded-xl border border-[#c1c6d6]" style={{ boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' }}>
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h4 className="text-xl font-semibold text-[#0b1c30]">{language === 'en' ? 'Ad Performance Over Time' : 'Rendimiento del Anuncio en el Tiempo'}</h4>
                        <p className="text-sm text-[#414754]">{language === 'en' ? 'Impressions, Clicks & Conversions comparison' : 'Comparativa de Impresiones, Clics y Conversiones'}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {[
                          { color: '#0058bc', label: language === 'en' ? 'Impressions' : 'Impresiones' },
                          { color: '#515f78', label: language === 'en' ? 'Clicks' : 'Clics' },
                          { color: '#006947', label: language === 'en' ? 'Conversions' : 'Conversiones' },
                        ].map((l, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
                            <span className="text-[12px] font-semibold">{l.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="h-[300px] flex items-end justify-between relative px-4">
                      {[
                        { day: 'Lun', h1: 40, h2: 15 },
                        { day: 'Mar', h1: 60, h2: 25 },
                        { day: language === 'en' ? 'Wed' : 'Mie', h1: 50, h2: 20 },
                        { day: 'Jue', h1: 85, h2: 45 },
                        { day: 'Vie', h1: 70, h2: 35 },
                        { day: language === 'en' ? 'Sat' : 'Sab', h1: 55, h2: 25 },
                        { day: 'Dom', h1: 95, h2: 60 },
                      ].map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-5 rounded-t" style={{ height: d.h1+'%', backgroundColor: '#0058bc' }} />
                          <div className="w-5 rounded-t -mt-8" style={{ height: d.h2+'%', backgroundColor: '#006947' }} />
                          <span className="text-[10px] text-[#414754] mt-2">{d.day}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Predictive Insights */}
                  <div className="lg:col-span-4 p-6 rounded-xl text-white flex flex-col" style={{ background: 'linear-gradient(135deg, #0058bc 0%, #0070eb 100%)', boxShadow: '0px 4px 12px rgba(0,0,0,0.1)' }}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined">auto_awesome</span>
                      <h4 className="text-xl font-semibold">Insights Predictivos AI</h4>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                        <p className="text-sm mb-2">{language === 'en' ? 'It is recommended to reallocate budget from' : 'Se recomienda reasignar presupuesto de'} <strong>{language === 'en' ? 'Summer Campaign' : 'Campaña Verano'}</strong> {language === 'en' ? 'to' : 'a'} <strong>Retargeting</strong>.</p>
                        <div className="flex justify-between items-center text-[11px]">
                          <span>ROI Estimado: +22%</span>
                          <span className="bg-[#006947] text-white px-2 py-0.5 rounded-full">{language === 'en' ? 'High Confidence' : 'Alta Confianza'}</span>
                        </div>
                      </div>
                      <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                        <p className="text-sm mb-2">{language === 'en' ? 'Mobile CTR increased 15% in last 24h. Increase bids.' : 'El CTR en dispositivos moviles ha subido un 15% en las ultimas 24h. Incrementar pujas.'}</p>
                        <div className="flex justify-between items-center text-[11px]">
                          <span>{language === 'en' ? 'Impact' : 'Impacto'}: $2,400+</span>
                          <span className="bg-white/20 text-white px-2 py-0.5 rounded-full">{language === 'en' ? 'Processing...' : 'Procesando...'}</span>
                        </div>
                      </div>
                    </div>
                    <button className="mt-6 w-full bg-white text-[#0058bc] py-3 rounded-lg font-bold hover:bg-[#eff4ff] transition-colors">
                      {language === 'en' ? 'Apply Auto Optimization' : 'Aplicar Optimizacion Automatica'}
                    </button>
                  </div>
                </div>

                {/* Bento: Platform Breakdown + Top Creatives */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Platform Breakdown */}
                  <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-[#c1c6d6]" style={{ boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' }}>
                    <h4 className="text-xl font-semibold text-[#0b1c30] mb-6">{language === 'en' ? 'Platform Breakdown' : 'Desglose por Plataforma'}</h4>
                    <div className="space-y-6">
                      {(fbInsights?.platformBreakdown?.length > 0 ? fbInsights.platformBreakdown : [
                        { platform: 'facebook', percentage: 0 },
                        { platform: 'instagram', percentage: 0 },
                        { platform: 'audience_network', percentage: 0 },
                        { platform: 'messenger', percentage: 0 },
                      ]).map((p: any, i: number) => (
                        <div key={i}>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium capitalize">{p.platform === 'facebook' ? 'Facebook News Feed' : p.platform === 'instagram' ? 'Instagram Stories' : p.platform === 'audience_network' ? 'Audience Network' : p.platform === 'messenger' ? 'Messenger' : p.platform}</span>
                            <span className="text-sm text-[#414754]">{p.percentage}%</span>
                          </div>
                          <div className="h-2 bg-[#e5eeff] rounded-full overflow-hidden">
                            <div className="h-full bg-[#0058bc] rounded-full transition-all duration-500" style={{ width: p.percentage+'%' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Creatives Table */}
                  <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-[#c1c6d6] overflow-hidden" style={{ boxShadow: '0px 4px 12px rgba(0,0,0,0.05)' }}>
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-xl font-semibold text-[#0b1c30]">{language === 'en' ? 'Top Performing Creatives' : 'Creatividades con Mejor Rendimiento'}</h4>
                      <button className="text-[#0058bc] font-medium text-sm hover:underline">{language === 'en' ? 'View all' : 'Ver todas'}</button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-[#c1c6d6]">
                            <th className="py-3 text-[12px] font-semibold text-[#414754] uppercase">{language === 'en' ? 'Creative' : 'Creatividad'}</th>
                            <th className="py-3 text-[12px] font-semibold text-[#414754] uppercase text-center">Engagement</th>
                            <th className="py-3 text-[12px] font-semibold text-[#414754] uppercase text-center">Conv.</th>
                            <th className="py-3 text-[12px] font-semibold text-[#414754] uppercase text-right">ROAS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#c1c6d6]">
                          {(fbInsights?.topCreatives?.length > 0 ? fbInsights.topCreatives.map((c: any) => ({
                            name: c.name, campaign: 'CTR: ' + c.ctr + '%', engagement: c.ctr + '%', conv: c.conversions || c.clicks, roas: c.spend !== '0.00' ? ((parseInt(c.clicks||'0') * 2) / parseFloat(c.spend || '1')).toFixed(1) + 'x' : '--', icon: 'campaign'
                          })) : [
                            { name: language === 'en' ? 'No creatives yet' : 'Sin creatividades', campaign: '--', engagement: '--', conv: '--', roas: '--', icon: 'info' },
                          ]).map((c: any, i: number) => (
                            <tr key={i}>
                              <td className="py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded bg-[#e5eeff] overflow-hidden flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[#0058bc]">{c.icon}</span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">{c.name}</p>
                                    <p className="text-[11px] text-[#414754]">{c.campaign}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 text-center text-sm font-medium">{c.engagement}</td>
                              <td className="py-4 text-center text-sm font-medium">{c.conv}</td>
                              <td className="py-4 text-right text-sm font-bold text-[#006947]">{c.roas}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                <button onClick={() => setSegDetailView(segDetailView === 'interested' ? 'chatting' : segDetailView === 'chatting' ? 'bought' : 'interested')} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                  <span className="material-symbols-outlined text-sm">filter_list</span>
                  {language === 'en' ? 'Filter' : 'Filtrar'}
                </button>
                <button onClick={() => setShowNewSegmentModal(true)} className="px-5 py-2.5 bg-primary-container text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-primary-container/20">
                  <span className="material-symbols-outlined text-sm">add</span>
                  {language === 'en' ? 'New Segment' : 'Nuevo Segmento'}
                </button>
              </div>
            </header>

            {/* Bento Grid Section: Overview Cards */}
            <section className="grid grid-cols-12 gap-6">
              {/* Stat Card: Interesados */}
              <div onClick={() => { setSegDetailView('interested'); setSegTablePage(1); }} className={`col-span-12 md:col-span-4 bg-white p-8 rounded-2xl flex flex-col justify-between hover:shadow-xl hover:shadow-slate-200/50 transition-all border-l-4 ${segDetailView === 'interested' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-emerald-500'} shadow-sm group cursor-pointer`}>
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
              <div onClick={() => { setSegDetailView('chatting'); setSegTablePage(1); }} className={`col-span-12 md:col-span-4 bg-white p-8 rounded-2xl flex flex-col justify-between hover:shadow-xl hover:shadow-slate-200/50 transition-all border-l-4 ${segDetailView === 'chatting' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-500'} shadow-sm group cursor-pointer`}>
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
              <div onClick={() => { setSegDetailView('bought'); setSegTablePage(1); }} className={`col-span-12 md:col-span-4 bg-white p-8 rounded-2xl flex flex-col justify-between hover:shadow-xl hover:shadow-slate-200/50 transition-all border-l-4 ${segDetailView === 'bought' ? 'border-slate-400 ring-2 ring-slate-300' : 'border-slate-400'} shadow-sm group cursor-pointer`}>
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
                  <button onClick={() => setShowNewSegmentModal(true)} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-primary-container hover:text-primary-container transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    {language === 'en' ? 'CREATE NEW CLASSIFICATION LOGIC' : 'CREAR NUEVA LOGICA DE CLASIFICACION'}
                  </button>
                  {/* Custom Segments */}
                  {customSegments.map(seg => (
                    <div key={seg.id} className="p-5 rounded-2xl bg-violet-50/50 border border-violet-100 hover:border-primary-container/30 transition-all flex items-start gap-4 group">
                      <div className="w-12 h-12 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-600 shrink-0 shadow-sm">
                        <span className="material-symbols-outlined">label</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-primary">{seg.name}</h4>
                          <div className="flex gap-2">
                            <span className="px-2.5 py-1 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-lg uppercase tracking-wider">{language === 'en' ? 'Custom' : 'Personalizado'}</span>
                            <button onClick={() => handleDeleteSegment(seg.id)} className="text-slate-400 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-sm">delete</span></button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 mb-3">{seg.description || (language === 'en' ? 'Keywords' : 'Palabras clave')}: {seg.keywords.join(', ') || '-'}</p>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${seg.confidence}%` }}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">{language === 'en' ? 'Confidence' : 'Confianza'}: {seg.confidence}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Bottom Section: Segment Table */}
            <section className="space-y-6">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-bold font-headline text-primary">
                    {language === 'en' ? `Detailed View: ${segDetailLabel}` : `Vista Detallada: ${segDetailLabel}`}
                  </h3>
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                    <button onClick={() => setSegViewMode('live')} className={`px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${segViewMode === 'live' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-primary'}`}>Live</button>
                    <button onClick={() => setSegViewMode('archive')} className={`px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${segViewMode === 'archive' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-primary'}`}>Archive</button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleExportSegmentCSV} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
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
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language === 'en' ? 'Contact' : 'Contacto'}</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language === 'en' ? 'Last Activity' : 'Última Actividad'}</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language === 'en' ? 'Phone Number' : 'Teléfono'}</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language === 'en' ? 'AI Confidence' : 'Confianza IA'}</th>
                        <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">{language === 'en' ? 'Actions' : 'Acciones'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pagedSegContacts.map((contact: any, i: number) => {
                        const score = contactScores[contact.id]?.score;
                        const confidence = score != null ? score : Math.floor(Math.random() * 20 + 75);
                        const statusColor = contact.status === 'interested' ? 'emerald' : contact.status === 'chatting' ? 'amber' : 'slate';
                        return (
                        <tr key={contact.id || i} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full bg-${statusColor}-100 flex items-center justify-center font-bold text-${statusColor}-700 text-xs shadow-sm`}>
                                {contact.customer_name?.substring(0, 2).toUpperCase() || 'CX'}
                              </div>
                              <div>
                                <p className="font-bold text-primary text-sm">{contact.customer_name || 'Desconocido'}</p>
                                <p className={`text-[10px] font-bold text-${statusColor}-600 uppercase tracking-wider`}>{contact.status === 'interested' ? 'Interesado' : contact.status === 'chatting' ? 'En chat' : 'Comprador'}</p>
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
                                <div className={`h-full bg-${confidence >= 85 ? 'emerald' : confidence >= 60 ? 'amber' : 'red'}-500 rounded-full`} style={{ width: `${confidence}%` }}></div>
                              </div>
                              <span className={`text-[10px] font-black text-${confidence >= 85 ? 'emerald' : confidence >= 60 ? 'amber' : 'red'}-600`}>{confidence}%</span>
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
                        );
                      })}
                      {segDetailContacts.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-8 py-20 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-3">
                              <span className="material-symbols-outlined text-5xl opacity-20">group_off</span>
                              <p className="text-xs font-bold uppercase tracking-widest">
                                {language === 'en' ? 'No contacts found in this segment' : 'No se encontraron contactos en este segmento'}
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
                    {language === 'en' ? `Showing ${pagedSegContacts.length} of ${segDetailContacts.length} contacts` : `Mostrando ${pagedSegContacts.length} de ${segDetailContacts.length} contactos`}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => setSegTablePage(p => Math.max(1, p - 1))} disabled={segTablePage <= 1} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-sm disabled:opacity-30"><span className="material-symbols-outlined text-sm">chevron_left</span></button>
                    {Array.from({ length: Math.min(totalSegPages, 5) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setSegTablePage(p)} className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all ${segTablePage === p ? 'bg-primary-container text-white shadow-lg shadow-primary-container/20' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{p}</button>
                    ))}
                    <button onClick={() => setSegTablePage(p => Math.min(totalSegPages, p + 1))} disabled={segTablePage >= totalSegPages} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all shadow-sm disabled:opacity-30"><span className="material-symbols-outlined text-sm">chevron_right</span></button>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {/* ========== BILLING / PAGOS TAB ========== */}
        {activeTab === 'billing' && (
          <motion.div key="billing" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="space-y-6">
            {/* Expired Plan Alert */}
            {isPlanExpired && (
              <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-6 shadow-lg shadow-red-500/20 text-white">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-3xl animate-pulse">warning</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black">{language === 'en' ? 'Your plan has expired' : 'Tu plan ha expirado'}</h3>
                    <p className="text-white/80 text-sm mt-1">{language === 'en' 
                      ? 'All features are locked. Choose a plan below to restore access to your CRM, contacts, AI bot, and analytics.' 
                      : 'Todas las funciones est\u00e1n bloqueadas. Elige un plan para restaurar el acceso a tu CRM, contactos, bot de IA y an\u00e1lisis.'}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="inline-flex items-center gap-1.5 text-xs bg-white/20 px-3 py-1 rounded-full"><span className="material-symbols-outlined text-sm">lock</span> CRM</span>
                      <span className="inline-flex items-center gap-1.5 text-xs bg-white/20 px-3 py-1 rounded-full"><span className="material-symbols-outlined text-sm">lock</span> Bot IA</span>
                      <span className="inline-flex items-center gap-1.5 text-xs bg-white/20 px-3 py-1 rounded-full"><span className="material-symbols-outlined text-sm">lock</span> Analytics</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                <button onClick={() => { if (showPlanConfirm) handleUpgradePlan(showPlanConfirm); }} className="flex-1 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-500/20 hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">credit_card</span>
                  {language === 'en' ? 'Pay with Card' : 'Pagar con Tarjeta'}
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
                {/* Calendar dropdown */}
                <div className="relative">
                  <button onClick={() => setShowHeaderCalendar(!showHeaderCalendar)} className="flex items-center gap-3 bg-white border border-slate-100 px-5 py-3 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer">
                    <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      {MONTH_NAMES[analyticsCalMonth]} {analyticsCalYear}
                    </span>
                    <span className={`material-symbols-outlined text-sm text-slate-300 transition-transform ${showHeaderCalendar ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  {showHeaderCalendar && (
                    <div className="absolute top-full mt-2 right-0 w-[340px] bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 z-50" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-4">
                        <button onClick={() => { if (analyticsCalMonth === 0) { setAnalyticsCalMonth(11); setAnalyticsCalYear(y => y - 1); } else setAnalyticsCalMonth(m => m - 1); }} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"><span className="material-symbols-outlined text-sm">chevron_left</span></button>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-primary">{MONTH_NAMES[analyticsCalMonth]}</span>
                          <select value={analyticsCalYear} onChange={e => setAnalyticsCalYear(Number(e.target.value))} className="text-sm font-black text-primary bg-transparent border-none cursor-pointer focus:outline-none">
                            {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </div>
                        <button onClick={() => { if (analyticsCalMonth === 11) { setAnalyticsCalMonth(0); setAnalyticsCalYear(y => y + 1); } else setAnalyticsCalMonth(m => m + 1); }} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"><span className="material-symbols-outlined text-sm">chevron_right</span></button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {DAY_LABELS.map(d => <div key={d} className="text-center text-[9px] font-black text-slate-400 uppercase py-1">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {analyticsCalDays.map((d, i) => d === null ? <div key={`e-${i}`} /> : (
                          <div key={d.day} className={`relative text-center py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${d.amount > 0 ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-200' : 'text-slate-500 hover:bg-slate-50'}`} title={d.amount > 0 ? `$${d.amount.toFixed(2)}` : 'Sin ventas'}>
                            {d.day}
                            {d.amount > 0 && <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full"></div>}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language === 'en' ? 'Month Total' : 'Total del Mes'}</span>
                        <span className="text-lg font-black text-emerald-600">${calMonthTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={() => setShowExportModal(true)} className="bg-primary-container text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary-container/20 hover:opacity-90 active:scale-95 transition-all">
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
                  <span className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <span className="material-symbols-outlined">payments</span>
                  </span>
                  <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
                    {statsData?.totalSales || 0} {language === 'en' ? 'sales' : 'ventas'}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{language === 'en' ? 'Total Revenue' : 'Ingresos Totales'}</p>
                  <h3 className="text-4xl font-black text-emerald-600 tracking-tighter">
                    ${(statsData?.totalRevenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
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
                    <circle className="text-primary-container" cx="56" cy="56" fill="transparent" r="48" stroke="currentColor" strokeDasharray="301.6" strokeDashoffset={`${301.6 * (1 - (Object.keys(contactScores).length > 0 ? Object.values(contactScores).reduce((s: number, v: any) => s + (v.score || 0), 0) / Object.keys(contactScores).length : 92) / 100)}`} strokeWidth="10" strokeLinecap="round"></circle>
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-black text-primary">{Object.keys(contactScores).length > 0 ? Math.round(Object.values(contactScores).reduce((s: number, v: any) => s + (v.score || 0), 0) / Object.keys(contactScores).length) : 92}%</span>
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
                    <h3 className="text-3xl font-black text-primary tracking-tighter">{conversionRate}%</h3>
                    <span className="text-[10px] text-emerald-600 font-black">{conversionRate > 0 ? '+' : ''}{(conversionRate * 0.1).toFixed(1)}%</span>
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

              {/* Revenue Chart */}
              <div className="lg:col-span-8 bg-white p-10 rounded-3xl border border-slate-50 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-xl font-black text-primary mb-2">{language === 'en' ? 'Revenue' : 'Ingresos'}</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{language === 'en' ? 'Daily sales closed by AI' : 'Ventas cerradas por día'}</p>
                    <p className="text-2xl font-black text-emerald-600 mt-2">${periodRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                    <button onClick={() => setAnalyticsRange('30d')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${analyticsRange === '30d' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-primary'}`}>30 {language === 'en' ? 'Days' : 'Días'}</button>
                    <button onClick={() => setAnalyticsRange('90d')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${analyticsRange === '90d' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-primary'}`}>90 {language === 'en' ? 'Days' : 'Días'}</button>
                  </div>
                </div>
                <div className="relative h-[300px] w-full" onMouseLeave={() => setHoveredChartIdx(null)}>
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 200">
                    <defs>
                      <linearGradient id="revLineGrad" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#059669" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                      <linearGradient id="revAreaGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[50, 100, 150].map((y, i) => (
                      <line key={i} stroke="#e2e8f0" strokeDasharray="4 4" x1="0" x2="800" y1={y} y2={y}></line>
                    ))}
                    {revenueSvgData.area && <path d={revenueSvgData.area} fill="url(#revAreaGrad)"></path>}
                    {revenueSvgData.line && (
                      <motion.path 
                        key={analyticsRange}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        d={revenueSvgData.line} 
                        fill="none" 
                        stroke="url(#revLineGrad)" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="4"
                      ></motion.path>
                    )}
                    {revenueSvgData.points.map((p, i) => (
                      <g key={i}>
                        <rect x={p.x - (800 / revenueChartData.length / 2)} y="0" width={800 / revenueChartData.length} height="200" fill="transparent" onMouseEnter={() => setHoveredChartIdx(i)} />
                        {hoveredChartIdx === i && (
                          <>
                            <line x1={p.x} x2={p.x} y1={p.y} y2="200" stroke="#10b981" strokeDasharray="3 3" strokeWidth="1" opacity="0.5" />
                            <circle cx={p.x} cy={p.y} r="6" fill="#10b981" stroke="white" strokeWidth="3" />
                          </>
                        )}
                      </g>
                    ))}
                  </svg>
                  {hoveredChartIdx !== null && revenueSvgData.points[hoveredChartIdx] && (
                    <div className="absolute bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-xl pointer-events-none z-10" style={{ left: `${Math.min(85, Math.max(5, (revenueSvgData.points[hoveredChartIdx].x / 800) * 100))}%`, top: '10px', transform: 'translateX(-50%)' }}>
                      <p className="text-emerald-400 text-sm font-black">${revenueSvgData.points[hoveredChartIdx].amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      <p className="text-slate-400 text-[10px]">{revenueSvgData.points[hoveredChartIdx].label}</p>
                    </div>
                  )}
                  <div className="flex justify-between mt-4 border-t border-slate-50 pt-3">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{revenueChartData[0]?.label || ''}</span>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{revenueChartData[Math.floor(revenueChartData.length / 2)]?.label || ''}</span>
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

        {/* ========== ADMIN PANEL TAB ========== */}
        {activeTab === 'admin' && tenantData?.isAdmin && (
          <motion.div
            key="admin"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-8"
          >
            {/* Header */}
            <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                    <span className="material-symbols-outlined">admin_panel_settings</span>
                  </div>
                  <h2 className="text-3xl font-black text-primary tracking-tight">Panel de Administrador</h2>
                </div>
                <p className="text-sm text-slate-400 font-medium ml-[52px]">Gestiona usuarios, planes y anuncios de la plataforma</p>
              </div>
              <div className="flex gap-2 bg-white rounded-xl p-1.5 shadow-sm border border-slate-100">
                {[
                  { key: 'overview', label: 'Resumen', icon: 'dashboard' },
                  { key: 'tenants', label: 'Usuarios', icon: 'group' },
                  { key: 'announcements', label: 'Anuncios', icon: 'campaign' },
                ].map(t => (
                  <button key={t.key} onClick={() => setAdminTab(t.key as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${adminTab === t.key ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <span className="material-symbols-outlined text-sm">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </section>

            {adminLoading && !adminData ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              </div>
            ) : adminData && (
              <>
                {/* ===== OVERVIEW SUB-TAB ===== */}
                {adminTab === 'overview' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {[
                        { label: 'Total Usuarios', value: adminData.totalTenants, icon: 'group', color: 'from-blue-500 to-indigo-600' },
                        { label: 'Activos', value: adminData.activeTenants, icon: 'verified', color: 'from-emerald-500 to-teal-600' },
                        { label: 'Nuevos (7d)', value: adminData.newThisWeek, icon: 'trending_up', color: 'from-violet-500 to-purple-600' },
                        { label: 'Total Mensajes', value: adminData.totalMessages?.toLocaleString(), icon: 'chat', color: 'from-orange-500 to-amber-600' },
                      ].map((kpi, i) => (
                        <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-4">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center text-white shadow-lg`}>
                              <span className="material-symbols-outlined">{kpi.icon}</span>
                            </div>
                          </div>
                          <p className="text-3xl font-black text-primary">{kpi.value}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{kpi.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
                        <h3 className="text-lg font-extrabold text-primary mb-6">Distribución por Plan</h3>
                        <div className="space-y-4">
                          {Object.entries(adminData.planCounts || {}).map(([plan, count]: [string, any]) => {
                            const total = adminData.totalTenants || 1;
                            const pct = Math.round((count / total) * 100);
                            const colors: Record<string, string> = { trial: 'bg-slate-400', start: 'bg-blue-500', advanced: 'bg-violet-500', plus: 'bg-emerald-500', master: 'bg-orange-500' };
                            return (
                              <div key={plan}>
                                <div className="flex justify-between mb-1.5">
                                  <span className="text-xs font-bold text-primary capitalize">{plan}</span>
                                  <span className="text-xs font-bold text-slate-400">{count} ({pct}%)</span>
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full ${colors[plan] || 'bg-slate-400'} rounded-full transition-all duration-700`} style={{ width: `${pct || 2}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
                        <h3 className="text-lg font-extrabold text-primary mb-6">Estadísticas Globales</h3>
                        <div className="space-y-5">
                          {[
                            { label: 'Total Conversaciones', value: adminData.totalConversations, icon: 'forum' },
                            { label: 'Total Mensajes', value: adminData.totalMessages, icon: 'message' },
                            { label: 'Anuncios Activos', value: adminData.announcements?.filter((a: any) => a.is_active)?.length || 0, icon: 'campaign' },
                            { label: 'Pagos Registrados', value: adminData.payments?.length || 0, icon: 'receipt_long' },
                          ].map((s, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-slate-400">{s.icon}</span>
                                <span className="text-sm font-bold text-primary">{s.label}</span>
                              </div>
                              <span className="text-lg font-black text-primary">{s.value?.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
                      <h3 className="text-lg font-extrabold text-primary mb-6">Últimos Registros</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-50/50">
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Plan</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Registro</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {adminData.tenants?.slice(0, 5).map((t: any) => (
                              <tr key={t.id} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xs font-black">
                                      {t.companyName?.charAt(0)?.toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-primary">{t.companyName || 'Sin nombre'}</p>
                                      <p className="text-[10px] text-slate-400">{t.ownerName || ''}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">{t.email}</td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-3 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${t.plan === 'master' ? 'bg-orange-100 text-orange-700' : t.plan === 'plus' ? 'bg-emerald-100 text-emerald-700' : t.plan === 'advanced' ? 'bg-violet-100 text-violet-700' : t.plan === 'start' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{t.plan}</span>
                                </td>
                                <td className="px-6 py-4 text-right text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== TENANTS SUB-TAB ===== */}
                {adminTab === 'tenants' && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-extrabold text-primary">Usuarios Registrados</h3>
                          <p className="text-xs text-slate-400 mt-1">{adminData.totalTenants} usuarios en la plataforma</p>
                        </div>
                        <button onClick={loadAdminData} className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-500 transition-colors">
                          <span className="material-symbols-outlined text-sm">refresh</span> Actualizar
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-50/50">
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Plan</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Estado</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Admin</th>
                              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {adminData.tenants?.map((t: any) => (
                              <tr key={t.id} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black ${t.isAdmin ? 'bg-gradient-to-br from-orange-500 to-amber-500' : 'bg-gradient-to-br from-indigo-500 to-blue-600'}`}>
                                      {t.companyName?.charAt(0)?.toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-primary">{t.companyName || 'Sin nombre'}</p>
                                      <p className="text-[10px] text-slate-400">{t.ownerName || ''}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 font-medium">{t.email}</td>
                                <td className="px-6 py-4 text-center">
                                  {editingTenantId === t.id ? (
                                    <select value={editingTenantPlan} onChange={e => setEditingTenantPlan(e.target.value)} className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold bg-white">
                                      <option value="trial">Trial</option>
                                      <option value="start">Start</option>
                                      <option value="advanced">Advanced</option>
                                      <option value="plus">Plus</option>
                                      <option value="master">Master</option>
                                    </select>
                                  ) : (
                                    <span className={`px-3 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${t.plan === 'master' ? 'bg-orange-100 text-orange-700' : t.plan === 'plus' ? 'bg-emerald-100 text-emerald-700' : t.plan === 'advanced' ? 'bg-violet-100 text-violet-700' : t.plan === 'start' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{t.plan}</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`w-2.5 h-2.5 rounded-full inline-block ${t.planStatus === 'active' ? 'bg-emerald-500' : 'bg-red-400'}`}></span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {t.isAdmin && <span className="material-symbols-outlined text-orange-500 text-lg">shield</span>}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {editingTenantId === t.id ? (
                                      <>
                                        <button onClick={() => handleUpdateTenantPlan(t.id, editingTenantPlan)} disabled={adminActionLoading} className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 transition-colors">Guardar</button>
                                        <button onClick={() => setEditingTenantId(null)} className="px-3 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg hover:bg-slate-200 transition-colors">Cancelar</button>
                                      </>
                                    ) : (
                                      <>
                                        <button onClick={() => { setEditingTenantId(t.id); setEditingTenantPlan(t.plan); }} className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg hover:bg-blue-100 transition-colors">Cambiar Plan</button>
                                        {t.id !== tenantData?.id && (
                                          <button onClick={() => handleToggleAdmin(t.id, !t.isAdmin)} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${t.isAdmin ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                                            {t.isAdmin ? 'Quitar Admin' : 'Hacer Admin'}
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== ANNOUNCEMENTS SUB-TAB ===== */}
                {adminTab === 'announcements' && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-lg font-extrabold text-primary">Anuncios del Sistema</h3>
                          <p className="text-xs text-slate-400 mt-1">Los anuncios activos se muestran a todos los usuarios en su dashboard</p>
                        </div>
                        <button onClick={() => setShowAnnForm(!showAnnForm)} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-orange-500/20 hover:opacity-90 transition-all">
                          <span className="material-symbols-outlined text-sm">add</span>
                          Nuevo Anuncio
                        </button>
                      </div>

                      {showAnnForm && (
                        <div className="p-6 bg-slate-50 rounded-xl mb-6 border border-slate-200/50">
                          <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Título</label>
                              <input value={newAnnTitle} onChange={e => setNewAnnTitle(e.target.value)} placeholder="Ej: Nueva función disponible" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-primary bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Tipo</label>
                              <select value={newAnnType} onChange={e => setNewAnnType(e.target.value as any)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-primary bg-white focus:outline-none focus:border-orange-500">
                                <option value="info">i Información</option>
                                <option value="update"> Actualización</option>
                                <option value="warning">! Aviso Importante</option>
                                <option value="promo"> Promoción</option>
                              </select>
                            </div>
                          </div>
                          <div className="mb-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Mensaje</label>
                            <textarea value={newAnnMessage} onChange={e => setNewAnnMessage(e.target.value)} placeholder="Escribe el contenido del anuncio..." rows={3} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-primary bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all resize-none" />
                          </div>
                          
                          {/* Image Upload */}
                          <div className="mb-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Imagen (opcional)</label>
                            <input ref={annImageInputRef} type="file" accept="image/*" onChange={handleAnnImageSelect} className="hidden" />
                            {annImagePreview ? (
                              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                                <img src={annImagePreview} alt="Preview" className="w-full h-40 object-cover" />
                                <button onClick={() => { setAnnImageFile(null); setAnnImagePreview(''); }} className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md">
                                  <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => annImageInputRef.current?.click()} className="w-full p-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-orange-400 hover:bg-orange-50/30 transition-all flex flex-col items-center gap-2 group">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-orange-100 flex items-center justify-center transition-colors">
                                  <span className="material-symbols-outlined text-slate-400 group-hover:text-orange-500 transition-colors">add_photo_alternate</span>
                                </div>
                                <p className="text-xs font-bold text-slate-400 group-hover:text-orange-500 transition-colors">Haz clic para subir una imagen</p>
                                <p className="text-[10px] text-slate-300">JPG, PNG, WebP o GIF -- Máx. 5MB</p>
                              </button>
                            )}
                          </div>

                          {/* Button CTA */}
                          <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Texto del Botón (opcional)</label>
                              <input value={newAnnBtnText} onChange={e => setNewAnnBtnText(e.target.value)} placeholder="Ej: Ver más, Ir a la academia" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-primary bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">URL del Botón (opcional)</label>
                              <input value={newAnnBtnUrl} onChange={e => setNewAnnBtnUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-primary bg-white focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
                            </div>
                          </div>

                          <div className="flex justify-between items-center mt-2">
                            <button onClick={handleImproveAnnouncement} disabled={annAiLoading || (!newAnnTitle.trim() && !newAnnMessage.trim())} className="px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-bold rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2">
                              {annAiLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">auto_awesome</span>}
                              Mejorar con IA
                            </button>

                            <div className="flex justify-end gap-3">
                              <button onClick={() => { setShowAnnForm(false); setAnnImageFile(null); setAnnImagePreview(''); setNewAnnBtnText(''); setNewAnnBtnUrl(''); setAnnShowPreview(false); setAnnAiImproved(null); }} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all">Cancelar</button>
                              <button onClick={handleCreateAnnouncement} disabled={adminActionLoading || annImageUploading || !newAnnTitle.trim() || !newAnnMessage.trim()} className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2">
                                {(adminActionLoading || annImageUploading) ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">send</span>}
                                {annImageUploading ? 'Subiendo imagen...' : 'Publicar Anuncio'}
                              </button>
                            </div>
                          </div>

                          {/* AI Preview Section */}
                          {annShowPreview && annAiImproved && (
                            <div className="mt-6 p-5 bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-100 rounded-xl">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-violet-500 text-lg">auto_awesome</span>
                                <h4 className="text-sm font-extrabold text-violet-700">Propuesta de IA</h4>
                              </div>
                              <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
                                <p className="text-sm font-bold text-slate-800 mb-2">{annAiImproved.title}</p>
                                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{annAiImproved.message}</p>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button onClick={() => { setAnnShowPreview(false); setAnnAiImproved(null); }} className="px-4 py-2 bg-white border border-slate-200 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-50 transition-all">
                                  Descartar
                                </button>
                                <button onClick={handleApproveAiAnnouncement} className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-lg shadow hover:bg-violet-700 transition-all">
                                  Aprobar y Usar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-3">
                        {adminData.announcements?.length === 0 ? (
                          <div className="text-center py-12 text-slate-300">
                            <span className="material-symbols-outlined text-5xl mb-3 block">campaign</span>
                            <p className="text-sm font-bold">No hay anuncios creados</p>
                            <p className="text-xs mt-1">Crea tu primer anuncio para comunicarte con todos los usuarios</p>
                          </div>
                        ) : (
                          adminData.announcements?.map((ann: any) => {
                            const typeConfig: Record<string, { icon: string; bg: string; text: string; badge: string }> = {
                              info: { icon: 'info', bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
                              update: { icon: 'new_releases', bg: 'bg-violet-50', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700' },
                              warning: { icon: 'warning', bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
                              promo: { icon: 'celebration', bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
                            };
                            const cfg = typeConfig[ann.type] || typeConfig.info;
                            return (
                              <div key={ann.id} className={`p-5 rounded-xl border ${ann.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'} transition-all`}>
                                {ann.image_url && (
                                  <div className="mb-3 rounded-lg overflow-hidden h-32">
                                    <img src={ann.image_url} alt={ann.title} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-start gap-4 flex-1">
                                    <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                                      <span className={`material-symbols-outlined ${cfg.text}`}>{cfg.icon}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm font-extrabold text-primary">{ann.title}</h4>
                                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase ${cfg.badge}`}>{ann.type}</span>
                                        {!ann.is_active && <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-red-100 text-red-600 uppercase">Inactivo</span>}
                                      </div>
                                      <p className="text-xs text-slate-500 line-clamp-2">{ann.message}</p>
                                      {ann.button_text && <p className="text-[10px] text-blue-500 mt-1 font-bold"> {ann.button_text}</p>}
                                      <p className="text-[10px] text-slate-300 mt-2">{new Date(ann.created_at).toLocaleString()}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <button onClick={() => handleToggleAnnouncement(ann.id, !ann.is_active)} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${ann.is_active ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                                      {ann.is_active ? 'Desactivar' : 'Activar'}
                                    </button>
                                    <button onClick={() => handleDeleteAnnouncement(ann.id)} className="px-3 py-1.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-lg hover:bg-red-100 transition-colors">
                                      <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}


      {/* ========== NEW SEGMENT MODAL ========== */}
      {showNewSegmentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center px-4" onClick={() => setShowNewSegmentModal(false)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl mx-auto mb-4 flex items-center justify-center"><span className="material-symbols-outlined text-white text-2xl">add_circle</span></div>
              <h3 className="text-lg font-extrabold text-primary">{language === 'en' ? 'Create New Segment' : 'Crear Nuevo Segmento'}</h3>
              <p className="text-xs text-slate-400 mt-2">{language === 'en' ? 'Define custom classification rules for your audience' : 'Define reglas de clasificación personalizadas para tu audiencia'}</p>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{language === 'en' ? 'Segment Name' : 'Nombre del Segmento'}</label>
                <input value={newSegName} onChange={e => setNewSegName(e.target.value)} placeholder={language === 'en' ? 'e.g. VIP Customers' : 'ej. Clientes VIP'} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-primary bg-slate-50 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{language === 'en' ? 'Description' : 'Descripción'}</label>
                <input value={newSegDescription} onChange={e => setNewSegDescription(e.target.value)} placeholder={language === 'en' ? 'Brief description...' : 'Breve descripción...'} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-primary bg-slate-50 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{language === 'en' ? 'Keywords (comma separated)' : 'Palabras Clave (separadas por coma)'}</label>
                <input value={newSegKeywords} onChange={e => setNewSegKeywords(e.target.value)} placeholder={language === 'en' ? 'buy, price, deal' : 'comprar, precio, oferta'} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-primary bg-slate-50 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{language === 'en' ? 'Confidence Threshold' : 'Umbral de Confianza'}: {newSegConfidence}%</label>
                <input type="range" min="50" max="100" value={newSegConfidence} onChange={e => setNewSegConfidence(Number(e.target.value))} className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-violet-500" />
                <div className="flex justify-between text-[10px] text-slate-300 mt-1"><span>50%</span><span>100%</span></div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowNewSegmentModal(false)} className="flex-1 py-3 border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all">{language === 'en' ? 'Cancel' : 'Cancelar'}</button>
              <button onClick={handleCreateSegment} disabled={!newSegName.trim()} className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-violet-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-violet-500/20 hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined text-sm">add</span>
                {language === 'en' ? 'Create Segment' : 'Crear Segmento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== EXPORT REPORT MODAL ========== */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center px-4" onClick={() => setShowExportModal(false)}>
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl mx-auto mb-4 flex items-center justify-center"><span className="material-symbols-outlined text-white text-2xl">download</span></div>
              <h3 className="text-lg font-extrabold text-primary">{language === 'en' ? 'Export Sales Report' : 'Exportar Reporte de Ventas'}</h3>
              <p className="text-xs text-slate-400 mt-2">{language === 'en' ? 'Select date range to export' : 'Selecciona el rango de fechas a exportar'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{language === 'en' ? 'From' : 'Desde'}</label>
                <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-primary bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">{language === 'en' ? 'To' : 'Hasta'}</label>
                <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-primary bg-slate-50 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-500">{language === 'en' ? 'Days in range' : 'Días en el rango'}</span>
                <span className="text-sm font-black text-primary">{Math.max(0, Math.ceil((new Date(exportEndDate).getTime() - new Date(exportStartDate).getTime()) / 86400000) + 1)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">{language === 'en' ? 'Format' : 'Formato'}</span>
                <span className="text-sm font-black text-emerald-600">CSV (Excel)</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowExportModal(false)} className="flex-1 py-3 border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all">{language === 'en' ? 'Cancel' : 'Cancelar'}</button>
              <button onClick={handleExportExcel} className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-sm">download</span>
                {language === 'en' ? 'Download Excel' : 'Descargar Excel'}
              </button>
            </div>
          </div>
        </div>
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
                                  <p className="text-[8px] text-primary font-medium opacity-0 group-hover/item:opacity-100 transition-opacity">{language === 'es' ? 'Ir al chat ' : 'Go to chat '}</p>
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
                          const resPatch = await authFetch('/api/panel/pause', {
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
                            const res = await authFetch('/api/panel/conversations', {
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
                          <p className="text-[10px] font-medium text-slate-400">{language === 'en' ? 'Last Activity' : 'Última Actividad'}</p>
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
                              const resPause = await authFetch('/api/panel/pause', {
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
                            await authFetch('/api/panel/send-message', { method: 'POST', body: formData });
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
                              const res = await authFetch('/api/panel/generate-email', {
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

    {/* ========== ANNOUNCEMENT POPUP MODAL ========== */}
    {showAnnouncementPopup && platformAnnouncements.length > 0 && (() => {
      const ann = platformAnnouncements[currentPopupAnnIndex];
      if (!ann) return null;
      return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center px-4" onClick={dismissAnnouncementPopup}>
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 30 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative"
          onClick={e => e.stopPropagation()}
        >
          {/* Close button */}
          <button onClick={dismissAnnouncementPopup} className="absolute top-4 right-4 z-20 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white transition-all shadow-sm">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
          
          {/* Image */}
          {ann.image_url ? (
            <div className="relative w-full h-[260px]">
              <img src={ann.image_url} alt={ann.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
            </div>
          ) : (
            <div className="relative w-full h-[160px] bg-gradient-to-br from-primary-container via-blue-600 to-indigo-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-white/20 text-[100px]">campaign</span>
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent" />
            </div>
          )}
          
          {/* Carousel controls if multiple announcements */}
          {platformAnnouncements.length > 1 && (
            <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 flex justify-between z-20 pointer-events-none">
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentPopupAnnIndex((prev) => (prev > 0 ? prev - 1 : platformAnnouncements.length - 1)); }}
                className="w-10 h-10 rounded-full bg-white/50 backdrop-blur text-slate-900 flex items-center justify-center hover:bg-white transition-colors shadow-lg pointer-events-auto"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setCurrentPopupAnnIndex((prev) => (prev < platformAnnouncements.length - 1 ? prev + 1 : 0)); }}
                className="w-10 h-10 rounded-full bg-white/50 backdrop-blur text-slate-900 flex items-center justify-center hover:bg-white transition-colors shadow-lg pointer-events-auto"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}

          {/* Content */}
          <div className="p-8 -mt-4 relative z-10">
            <div className="flex items-center justify-between gap-2 mb-3">
              {(() => {
                const typeStyles: Record<string, { bg: string; text: string; label: string }> = {
                  info: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Información' },
                  update: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Actualización' },
                  warning: { bg: 'bg-red-100', text: 'text-red-700', label: 'Aviso Importante' },
                  promo: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Promoción' },
                };
                const ts = typeStyles[ann.type] || typeStyles.info;
                return <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-wider ${ts.bg} ${ts.text}`}>{ts.label}</span>;
              })()}
              
              {/* Dots */}
              {platformAnnouncements.length > 1 && (
                <div className="flex gap-1.5">
                  {platformAnnouncements.map((_, idx) => (
                    <div key={idx} className={`w-2 h-2 rounded-full ${idx === currentPopupAnnIndex ? 'bg-primary-container' : 'bg-slate-200'}`} />
                  ))}
                </div>
              )}
            </div>
            
            <h3 className="text-2xl font-black text-slate-900 mb-3 leading-tight">{ann.title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">{ann.message}</p>
            
            <div className="flex gap-3">
              {ann.button_text ? (
                <>
                  <button 
                    onClick={() => { if (ann.button_url) window.open(ann.button_url, '_blank'); dismissAnnouncementPopup(); }}
                    className="flex-1 py-3 bg-gradient-to-r from-primary-container to-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-blue-500/20"
                  >
                    {ann.button_text}
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                  <button onClick={dismissAnnouncementPopup} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
                    Cerrar
                  </button>
                </>
              ) : (
                <button onClick={dismissAnnouncementPopup} className="w-full py-3 bg-gradient-to-r from-primary-container to-blue-600 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-blue-500/20">
                  Entendido
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      );
    })()}

    {/* Lemon Squeezy Checkout Overlay Script */}
    <Script
      src="https://app.lemonsqueezy.com/js/lemon.js"
      strategy="lazyOnload"
      onLoad={() => {
        if (typeof window !== 'undefined' && (window as any).createLemonSqueezy) {
          (window as any).createLemonSqueezy();
        }
      }}
    />

    </>
  );
}

