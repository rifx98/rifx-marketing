const fs = require('fs');
const f = require('path').join(process.cwd(), 'app', 'panel', 'panel-client.tsx');
let c = fs.readFileSync(f, 'utf8');

const billingAndPlayground = `
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
                    <div key={plan.id} className={\`relative bg-white rounded-2xl border \${plan.popular ? 'border-primary-container shadow-lg shadow-primary-container/10 ring-2 ring-primary-container/20' : 'border-slate-200 shadow-sm'} p-6 flex flex-col transition-all hover:shadow-md\`}>
                      {plan.popular && (<div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-container text-white text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider">{language === 'en' ? 'Most Popular' : 'Mas Popular'}</div>)}
                      <h3 className="text-lg font-extrabold text-primary mb-1">{plan.name}</h3>
                      <div className="flex items-baseline gap-1 mb-4"><span className="text-3xl font-black text-slate-800">\${plan.price}</span><span className="text-sm text-slate-400 font-medium">{plan.period}</span></div>
                      <div className="space-y-2.5 flex-1 mb-6">
                        <div className="flex items-center gap-2 text-sm text-slate-600"><span className="material-symbols-outlined text-primary-container text-base">group</span><span>{plan.contacts.toLocaleString()} contactos</span></div>
                        <div className="flex items-center gap-2 text-sm text-slate-600"><span className="material-symbols-outlined text-primary-container text-base">smart_toy</span><span>{plan.bots} bots IA</span></div>
                        <div className="flex items-center gap-2 text-sm text-slate-600"><span className="material-symbols-outlined text-primary-container text-base">people</span><span>{plan.members} miembros</span></div>
                        <div className="flex items-center gap-2 text-sm text-slate-600"><span className="material-symbols-outlined text-primary-container text-base">cloud</span><span>{plan.storage}</span></div>
                      </div>
                      <button onClick={() => setShowPlanConfirm(plan)} className={\`w-full py-2.5 rounded-xl text-sm font-bold transition-all \${currentPlan === plan.id ? 'bg-slate-100 text-slate-400 cursor-default' : plan.popular ? 'bg-primary-container text-white hover:bg-primary-container/90 shadow-sm' : 'bg-slate-100 text-primary hover:bg-primary-container hover:text-white'}\`} disabled={currentPlan === plan.id}>
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
                        <p className="text-slate-500 text-sm mb-6">{language === 'en' ? \`Subscribe to \${showPlanConfirm.name} for $\${showPlanConfirm.price}\${showPlanConfirm.period}\` : \`Suscribirte al plan \${showPlanConfirm.name} por $\${showPlanConfirm.price}\${showPlanConfirm.period}\`}</p>
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
                      <div className="flex justify-start"><div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[75%] shadow-sm"><p className="text-sm text-slate-700">{language === 'en' ? 'Hello! I am your AI assistant. How can I help you?' : '\\u00a1Hola! Soy tu asistente IA. \\u00bfEn qu\\u00e9 puedo ayudarte?'}</p><p className="text-[10px] text-slate-400 mt-1">AI Agent</p></div></div>
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
                      <input type="text" placeholder={language === 'en' ? 'Type a test message...' : 'Escribe un mensaje de prueba...'} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary-container/50 focus:ring-1 focus:ring-primary-container/30 transition-all" />
                      <button className="px-5 py-3 bg-primary-container text-white rounded-xl font-bold text-sm hover:bg-primary-container/90 transition-all shadow-sm flex items-center gap-2"><span className="material-symbols-outlined text-lg">send</span></button>
                    </div>
                  </div>
                  <div className="col-span-12 lg:col-span-4 space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                      <h4 className="font-bold text-primary mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary-container">tune</span>{language === 'en' ? 'Model Settings' : 'Configuraci\\u00f3n del Modelo'}</h4>
                      <div className="space-y-3">
                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">{language === 'en' ? 'Provider' : 'Proveedor'}</label><select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-primary-container/50"><option>Groq (Llama 3)</option><option>OpenAI (GPT-4)</option><option>Google (Gemini Pro)</option></select></div>
                        <div><label className="text-xs font-semibold text-slate-500 mb-1 block">{language === 'en' ? 'Temperature' : 'Temperatura'}</label><input type="range" min="0" max="100" defaultValue="70" className="w-full accent-primary-container" /><div className="flex justify-between text-[10px] text-slate-400"><span>{language === 'en' ? 'Precise' : 'Preciso'}</span><span>{language === 'en' ? 'Creative' : 'Creativo'}</span></div></div>
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                      <h4 className="font-bold text-primary mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary-container">security</span>{language === 'en' ? 'Guardrails' : 'Seguridad'}</h4>
                      <div className="space-y-3">
                        {[{label: language === 'en' ? 'Block explicit content' : 'Bloquear contenido expl\\u00edcito', checked: true},{label: language === 'en' ? 'Limit to business topics' : 'Limitar a temas de negocio', checked: true},{label: language === 'en' ? 'Auto-escalate to human' : 'Auto-escalar a humano', checked: false}].map((g, i) => (<label key={i} className="flex items-center gap-3 cursor-pointer"><input type="checkbox" defaultChecked={g.checked} className="w-4 h-4 rounded accent-primary-container" /><span className="text-sm text-slate-600">{g.label}</span></label>))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
`;

// Insert before </AnimatePresence>
const marker = '          </AnimatePresence>';
const idx = c.indexOf(marker);
if (idx === -1) { console.log("Marker not found"); process.exit(1); }
c = c.substring(0, idx) + billingAndPlayground + '\n' + marker + c.substring(idx + marker.length);

fs.writeFileSync(f, c);
console.log('Billing + Playground tabs added! Lines:', c.split('\n').length);
