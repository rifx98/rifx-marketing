const fs = require('fs');
const f = require('path').join(process.cwd(), 'app', 'panel', 'panel-client.tsx');
let c = fs.readFileSync(f, 'utf8');

// 1. Fix activeTab type to include all tabs
c = c.replace(
  "const [activeTab, setActiveTab] = useState<'dashboard' | 'crm' | 'settings'>('dashboard');",
  "const [activeTab, setActiveTab] = useState<'dashboard' | 'crm' | 'settings' | 'billing' | 'playground'>('dashboard');\n  const [language, setLanguage] = useState<'es'|'en'>('es');\n  const [showWhatsappPanel, setShowWhatsappPanel] = useState(false);\n  const [currentPlan, setCurrentPlan] = useState('trial');\n  const [showPlanConfirm, setShowPlanConfirm] = useState<any>(null);"
);

// 2. Replace the entire return block - from sidebar to main layout
// Find the old dark sidebar and replace with white CRM theme
const oldSidebarStart = `<div className="min-h-screen max-h-screen bg-[#050505] text-white flex flex-col md:flex-row font-sans selection:bg-purple-500/30 overflow-hidden">`;
const oldSidebarEnd = `</motion.aside>`;

const sidebarEndIdx = c.indexOf(oldSidebarEnd) + oldSidebarEnd.length;
const sidebarStartIdx = c.indexOf(oldSidebarStart);

if (sidebarStartIdx === -1) { console.log("Sidebar start not found"); process.exit(1); }

const newShell = `{/* Google Material Symbols */}
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    
    <div className="min-h-screen max-h-screen bg-background text-on-surface flex font-body selection:bg-primary-container/20 overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-crm-surface-container-low border-r border-outline-variant/20 flex flex-col h-screen shrink-0 fixed z-30">
        <div className="p-6 flex items-center gap-3 border-b border-outline-variant/10">
          <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center shadow-lg shadow-primary-container/20">
            <span className="material-symbols-outlined text-white text-xl">smart_toy</span>
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-primary font-headline">Chatea Pro</h1>
            <p className="text-[10px] text-primary-container font-bold tracking-widest uppercase">CRM Platform</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <button onClick={() => setActiveTab('dashboard')} className={\`flex w-full items-center gap-3 px-4 py-3 \${activeTab === 'dashboard' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300\`}>
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>dashboard</span>
            <span>{language === 'en' ? 'Dashboard' : 'Panel'}</span>
          </button>
          <button onClick={() => setActiveTab('crm')} className={\`flex w-full items-center gap-3 px-4 py-3 \${activeTab === 'crm' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300\`}>
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>group</span>
            <span>{language === 'en' ? 'Users' : 'Usuarios'}</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={\`flex w-full items-center gap-3 px-4 py-3 \${activeTab === 'settings' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300\`}>
            <span className="material-symbols-outlined">settings</span>
            <span>{language === 'en' ? 'Settings' : 'Configuraciones'}</span>
          </button>
          <button onClick={() => setActiveTab('billing')} className={\`flex w-full items-center gap-3 px-4 py-3 \${activeTab === 'billing' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300\`}>
            <span className="material-symbols-outlined">payments</span>
            <span>{language === 'en' ? 'Plans & Billing' : 'Pagos'}</span>
          </button>
          <button onClick={() => setActiveTab('playground')} className={\`flex w-full items-center gap-3 px-4 py-3 \${activeTab === 'playground' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300\`}>
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
            {humanAlerts.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-error text-white text-[9px] font-bold flex items-center justify-center rounded-full">{humanAlerts.length}</span>}
          </div>
        </div>
      </div>`;

// Replace old sidebar with new shell
c = c.substring(0, sidebarStartIdx) + newShell + c.substring(sidebarEndIdx);

// 3. Replace old main content wrapper
c = c.replace(
  `<main className="flex-1 p-4 md:p-10 relative overflow-y-auto min-h-0">
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

          <AnimatePresence mode="wait">`,
  `{/* Main Content */}
      <main className="ml-64 pt-24 pb-12 px-10 relative overflow-y-auto h-screen">
          <AnimatePresence mode="wait">`
);

// 4. Fix closing tags at end - replace old closing structure
c = c.replace(
  `        </div>
      </main>
    </div>`,
  `      </main>`
);

// 5. Fix the chart modal bg color
c = c.replace(/bg-\[#0f0f0f\]/g, 'bg-white');
c = c.replace(/bg-black\/60/g, 'bg-black/40');
c = c.replace(/text-white/g, 'text-slate-800');
// Be careful not to break too much - restore specific white text
c = c.replace(/text-slate-800">\$/g, 'text-white">$'); // chart values

fs.writeFileSync(f, c);
console.log('Shell rebuilt! Lines:', c.split('\n').length);
