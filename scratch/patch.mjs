import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/extracted_logic.json', 'utf8'));
let { beforeReturn, chatModalContent, settingsFormContent } = data;

beforeReturn = beforeReturn.replace("const [activeTab, setActiveTab] = useState", "const [language, setLanguage] = useState('es');\n  const [activeTab, setActiveTab] = useState");

const startDiv = settingsFormContent.indexOf('<motion.div');
const endDiv = settingsFormContent.lastIndexOf('</motion.div>');
if (startDiv !== -1 && endDiv !== -1) {
    settingsFormContent = settingsFormContent.substring(startDiv, endDiv + 13);
}

const newJsx = `  return (
    <>
    <div className={\`min-h-screen \${language === 'es' ? 'lang-es' : 'lang-en'} bg-crm-surface text-on-surface overflow-x-hidden font-inter\`}>
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
          <button onClick={() => setActiveTab('dashboard')} className={\`flex w-full items-center gap-3 px-4 py-3 \${activeTab === 'dashboard' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300\`}>
            <span className="material-symbols-outlined">dashboard</span>
            <span>{language === 'en' ? 'Dashboard' : 'Panel Principal'}</span>
          </button>
          <button onClick={() => setActiveTab('crm')} className={\`flex w-full items-center gap-3 px-4 py-3 \${activeTab === 'crm' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300\`}>
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>group</span>
            <span>{language === 'en' ? 'Users' : 'Usuarios'}</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={\`flex w-full items-center gap-3 px-4 py-3 \${activeTab === 'settings' ? 'bg-white text-[#000080] rounded-lg shadow-sm font-bold scale-[0.98]' : 'text-slate-500 hover:text-[#000080] font-medium'} transition-all duration-300\`}>
            <span className="material-symbols-outlined">settings</span>
            <span>{language === 'en' ? 'Settings' : 'Configuraciones'}</span>
          </button>
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <button onClick={() => setLanguage(language === 'en' ? 'es' : 'en')} className="w-full py-2 px-4 bg-crm-surface-container-low text-primary rounded-md font-bold text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-2 border border-slate-300">
            <span className="material-symbols-outlined text-sm">translate</span>
            {language === 'en' ? 'Switch to Spanish' : 'Cambiar a Inglés'}
          </button>
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
      <main className="ml-64 pt-24 pb-12 px-10 min-h-screen">
        {activeTab === 'crm' && (
          <>
            <section className="mb-12 flex justify-between items-end">
              <div className="max-w-2xl">
                <span className="text-primary-container font-extrabold tracking-[0.2em] text-[10px] uppercase mb-2 block">Enterprise CRM</span>
                <h1 className="text-5xl font-extrabold text-primary tracking-tight mb-4 font-headline">{language === 'en' ? 'Audience Intelligence' : 'Inteligencia de Audiencia'}</h1>
                <p className="text-lg text-slate-500 font-light leading-relaxed">
                  {language === 'en' ? 'Advanced orchestration of your WhatsApp ecosystem. Synchronize, segment, and influence your contact base with real-time AI behavioral detection.' : 'Orquestación avanzada de tu ecosistema WhatsApp. Sincroniza, segmenta e influye en tu base de contactos con detección de comportamiento de IA en tiempo real.'}
                </p>
              </div>
            </section>

            {/* Stats Grid */}
            <section className="grid grid-cols-12 gap-6 mb-12">
              <div className="col-span-12 lg:col-span-8 grid grid-cols-3 gap-6">
                <div className="bg-crm-surface-container-lowest p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-200 relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary-container/5 rounded-full blur-2xl group-hover:bg-primary-container/10 transition-colors"></div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{language === 'en' ? 'Total Users' : 'Usuarios Totales'}</p>
                  <h3 className="text-3xl font-extrabold text-primary">{((conversationsData?.chatting?.length || 0) + (conversationsData?.interested?.length || 0) + (conversationsData?.bought?.length || 0)) || 0}</h3>
                </div>
                <div className="bg-crm-surface-container-lowest p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-200">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{language === 'en' ? 'Active Now' : 'Activos Ahora'}</p>
                  <h3 className="text-3xl font-extrabold text-primary">{conversationsData?.chatting?.length || 0}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-slate-500 text-xs font-medium">{language === 'en' ? 'Real-time sync' : 'Sincronización en tiempo real'}</span>
                  </div>
                </div>
                <div className="bg-crm-surface-container-lowest p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-200">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{language === 'en' ? 'Conversions' : 'Conversiones'}</p>
                  <h3 className="text-3xl font-extrabold text-primary">{conversationsData?.bought?.length || 0}</h3>
                </div>
              </div>
            </section>

            <div className="flex gap-8 items-start">
              <div className="flex-1">
                <div className="bg-crm-surface-container-lowest rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-4">
                      <h3 className="font-extrabold text-primary flex items-center gap-2">
                        {language === 'en' ? 'Contact Directory' : 'Directorio de Contactos'}
                      </h3>
                    </div>
                  </div>
                  <table className="w-full text-left border-collapse bg-white">
                    <thead>
                      <tr className="bg-crm-surface-container-low/30 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'User Identity' : 'Identidad del Usuario'}</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'Status' : 'Estado'}</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{language === 'en' ? 'Phone' : 'Teléfono'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...(conversationsData?.chatting || []), ...(conversationsData?.interested || []), ...(conversationsData?.bought || [])].map((conv, idx) => (
                        <tr key={conv.id} onClick={() => setSelectedChat({id: conv.id, name: conv.customer_name, status: conv.status})} className={\`hover:bg-slate-50 transition-colors group cursor-pointer \${idx % 2 === 0 ? '' : 'bg-slate-50/50'}\`}>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {conv.customer_name?.substring(0, 2).toUpperCase() || 'U'}
                              </div>
                              <div>
                                <p className="font-bold text-primary group-hover:text-primary-container transition-colors">{conv.customer_name || 'Usuario'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className={\`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider \${conv.status === 'chatting' ? 'bg-[#eef2ff] text-[#000080]' : conv.status === 'interested' ? 'bg-[#fffbeb] text-[#b45309]' : 'bg-[#ecfdf5] text-[#047857]'}\`}>
                              {conv.status === 'chatting' ? (language === 'en' ? 'Chatting' : 'Chateando') : conv.status === 'interested' ? (language === 'en' ? 'Interested' : 'Interesado') : (language === 'en' ? 'Bought' : 'Compró')}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <p className="text-xs text-on-surface font-medium mb-1 truncate">{conv.phone_number}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detail Sidebar */}
              <aside className="w-96 sticky top-24">
                <div className="bg-crm-surface-container-low rounded-2xl p-6 shadow-sm flex flex-col gap-6 relative overflow-hidden border border-slate-200">
                  <div className="absolute top-0 left-0 w-full h-1 bg-primary-container"></div>
                  {selectedChat ? (
                    <>
                      <div className="text-center">
                        <div className="relative inline-block mb-3">
                          <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl shadow-lg border-4 border-white">
                            {selectedChat.name?.substring(0, 2).toUpperCase() || 'U'}
                          </div>
                        </div>
                        <h3 className="text-xl font-extrabold text-primary">{selectedChat.name || 'Usuario'}</h3>
                        <p className="text-sm text-slate-400">{selectedChat.status}</p>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <button onClick={() => setShowChartModal(true)} className="py-2.5 bg-primary-container text-white rounded-lg text-[11px] font-bold shadow-md hover:shadow-lg transition-all">
                          {language === 'en' ? 'Direct Chat Open' : 'Chat Directo Abierto'} (Ver Modal)
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-sm font-bold">
                      {language === 'en' ? 'Select a user to view details' : 'Selecciona un usuario en la tabla'}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}

        {/* SETTINGS AREA */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-8 font-headline">{language === 'en' ? 'Settings & Licenses' : 'Configuraciones y Licencias'}</h1>
            <div className="bg-[#050505] p-6 rounded-2xl text-white">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-white">
                    {language === 'en' ? 'System Configuration' : 'Configuración del Sistema'}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {language === 'en' ? 'Legacy Configuration Area' : 'Área de configuración heredada'}
                  </p>
                </div>
                SETTINGS_CONTENT_PLACEHOLDER
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-8 font-headline">{language === 'en' ? 'Dashboard' : 'Panel Principal'}</h1>
            <p className="text-slate-500 font-medium">
              {language === 'en' ? 'Welcome to Sovereign Intelligence v1.0.' : 'Bienvenido a Inteligencia Soberana v1.0.'}
            </p>
          </div>
        )}
      </main>
    </div>
`;

const replacedJsx = newJsx.replace('SETTINGS_CONTENT_PLACEHOLDER', settingsFormContent);

fs.writeFileSync('app/panel/panel-client.tsx', beforeReturn + replacedJsx + chatModalContent);
console.log('Successfully patched app/panel/panel-client.tsx');
