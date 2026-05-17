import fs from 'fs';

let content = fs.readFileSync('app/panel/panel-client.tsx', 'utf8');

const modalStart = content.indexOf('{/* ----------------- FULL SCREEN INBOX (Portal to body) ----------------- */}');
if (modalStart === -1) {
    console.error('Modal start not found');
    process.exit(1);
}

const portalEndStr = 'document.body\n    )}';
const portalEnd = content.indexOf(portalEndStr, modalStart);
if (portalEnd === -1) {
    console.error('Modal end not found');
    process.exit(1);
}

const beforeModal = content.substring(0, modalStart);
const afterModal = content.substring(portalEnd + portalEndStr.length);

const newModalJsx = `
{/* ----------------- FULL SCREEN INBOX (Portal to body) ----------------- */}
    {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {selectedChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-surface text-on-surface font-body overflow-y-auto"
          >
            {/* TopAppBar Anchor */}
            <header className="bg-[#f8f9fa] dark:bg-[#00003c] flex justify-between items-center w-full px-8 h-16 sticky top-0 z-50 shadow-[0_24px_24px_rgba(25,28,29,0.04)]">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedChat(null)} className="p-2 hover:bg-surface-container-low rounded-full transition-colors flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary-container">arrow_back</span>
                </button>
                <h2 className="font-['Manrope'] font-bold tracking-tight text-xl text-[#000080] dark:text-white">RIFX Sovereign</h2>
              </div>
              <div className="flex items-center gap-6">
                <div className="relative hidden sm:block">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm" style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>search</span>
                  <input className="bg-surface-container-low border-none rounded-full pl-10 pr-4 py-1.5 text-sm focus:ring-2 focus:ring-primary-container/20 w-64 text-black" placeholder="Search interactions..." type="text"/>
                </div>
                
                {/* Botón de Control IA (Agregado al header para mantener la funcionalidad) */}
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
                    } else {
                      const errData = await resPatch.json();
                      alert(\`Error al cambiar modo: \${errData.error}\`);
                    }
                  }}
                  className={\`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 \${
                    isHumanMode
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
                  }\`}
                >
                  <span className="material-symbols-outlined text-[16px]">{isHumanMode ? 'smart_toy' : 'person'}</span>
                  {isHumanMode ? 'Devolver a IA' : 'Tomar Control'}
                </button>

                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-slate-500 cursor-pointer hover:bg-[#f3f4f5] p-2 rounded-full transition-colors">notifications</span>
                  <span className="material-symbols-outlined text-slate-500 cursor-pointer hover:bg-[#f3f4f5] p-2 rounded-full transition-colors">help</span>
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
                <section className="bg-surface-container-lowest rounded-xl p-8 shadow-[0_24px_24px_rgba(25,28,29,0.02)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 rounded-full -mr-16 -mt-16"></div>
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-surface-container mb-4 bg-primary-container flex items-center justify-center text-white text-3xl font-bold">
                      {selectedChat.name?.substring(0, 2).toUpperCase() || 'U'}
                    </div>
                    <h3 className="font-display text-2xl font-extrabold text-on-surface tracking-tight">{selectedChat.name || 'Usuario'}</h3>
                    <p className="text-secondary font-medium mt-1 font-body">+52 55 1234 5678</p>
                    <div className="mt-4 px-4 py-1.5 bg-primary-container text-white text-xs font-bold rounded-full uppercase tracking-widest">
                      {selectedChat.status || 'Chatting'}
                    </div>
                    <div className="grid grid-cols-4 gap-3 w-full mt-8">
                      <button className="flex flex-col items-center justify-center p-3 rounded-lg bg-surface-container-low hover:bg-primary-container hover:text-white transition-all group">
                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">chat</span>
                        <span className="text-[10px] mt-1 font-bold uppercase">Message</span>
                      </button>
                      <button className="flex flex-col items-center justify-center p-3 rounded-lg bg-surface-container-low hover:bg-primary-container hover:text-white transition-all group">
                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">call</span>
                        <span className="text-[10px] mt-1 font-bold uppercase">Call</span>
                      </button>
                      <button className="flex flex-col items-center justify-center p-3 rounded-lg bg-surface-container-low hover:bg-primary-container hover:text-white transition-all group">
                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">edit</span>
                        <span className="text-[10px] mt-1 font-bold uppercase">Edit</span>
                      </button>
                      <button className="flex flex-col items-center justify-center p-3 rounded-lg bg-surface-container-low hover:bg-primary-container hover:text-white transition-all group">
                        <span className="material-symbols-outlined text-primary-container group-hover:text-white">more_horiz</span>
                        <span className="text-[10px] mt-1 font-bold uppercase">More</span>
                      </button>
                    </div>
                  </div>
                </section>
                
                {/* 2. AI Intelligence Insights */}
                <section className="bg-[rgba(75,83,188,0.05)] backdrop-blur-[20px] border border-[rgba(198,197,213,0.2)] rounded-xl p-6 border-l-4 border-l-primary-container">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-primary-container">psychology</span>
                    <h4 className="font-display font-bold text-lg text-primary-container tracking-tight">AI Intelligence Profile</h4>
                  </div>
                  <div className="space-y-6">
                    {/* Propensity Gauge */}
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Propensity to Convert</span>
                        <span className="text-xl font-extrabold text-primary-container">88%</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full" style={{width: '88%'}}></div>
                      </div>
                    </div>
                    {/* Sentiment Analysis */}
                    <div className="flex items-center justify-between p-4 bg-white/50 rounded-lg">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Sentiment Analysis</p>
                        <p className="text-sm font-semibold text-on-surface">Consistently Positive</p>
                      </div>
                      <span className="material-symbols-outlined text-emerald-600 scale-125" style={{fontVariationSettings: "'FILL' 1"}}>sentiment_very_satisfied</span>
                    </div>
                    {/* Key Interests */}
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-3">Key Intent Keywords</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-primary-container/10 text-primary-container text-xs font-semibold rounded-md">Automation</span>
                        <span className="px-3 py-1 bg-primary-container/10 text-primary-container text-xs font-semibold rounded-md">Enterprise Plan</span>
                        <span className="px-3 py-1 bg-primary-container/10 text-primary-container text-xs font-semibold rounded-md">API Access</span>
                        <span className="px-3 py-1 bg-primary-container/10 text-primary-container text-xs font-semibold rounded-md">Scalability</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 4. Behavioral Data */}
                <section className="bg-surface-container-low rounded-xl p-6">
                  <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest mb-4">Behavioral Telemetry</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-lg">
                      <p className="text-[10px] font-medium text-slate-400">Classification</p>
                      <p className="text-lg font-bold text-primary-container">94% Conf.</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg">
                      <p className="text-[10px] font-medium text-slate-400">Interactions</p>
                      <p className="text-lg font-bold text-primary-container">42 Total</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg col-span-2">
                      <p className="text-[10px] font-medium text-slate-400">Last Activity</p>
                      <p className="text-sm font-bold text-primary-container">Today, 14:22 (24m ago)</p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Column 2: Timeline & Notes */}
              <div className="col-span-12 lg:col-span-8 space-y-8">
                {/* 3. Communication Timeline */}
                <section className="bg-surface-container-lowest rounded-xl shadow-[0_24px_24px_rgba(25,28,29,0.02)] flex flex-col h-[600px]">
                  <div className="p-6 border-b border-surface-container-low flex justify-between items-center">
                    <h4 className="font-display font-bold text-lg">Communication Timeline</h4>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-surface-container text-[10px] font-bold rounded cursor-pointer">WhatsApp</span>
                      <span className="px-3 py-1 bg-surface-container-low text-[10px] font-bold rounded cursor-pointer opacity-50">Email</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide" ref={chatContainerRef}>
                    {loadingMessages ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-slate-500 text-sm">No hay mensajes aún</div>
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
                              <div className="relative flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center">
                                  <div className="w-full border-t border-surface-container-highest"></div>
                                </div>
                                <span className="relative bg-surface-container-lowest px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{msgDate}</span>
                              </div>
                            )}
                            
                            {isUser ? (
                              <div className="flex flex-col items-start">
                                <div className="max-w-[80%] bg-surface-container-high text-on-surface p-4 rounded-xl rounded-tl-sm">
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedChat.name} • {time}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end">
                                <div className="max-w-[80%] bg-primary-container text-white p-4 rounded-xl rounded-tr-sm shadow-sm opacity-90">
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="material-symbols-outlined text-[14px] text-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">AI Sovereign • {time}</span>
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </div>
                  
                  <div className="p-6 bg-surface-container-low/50">
                    <div className="relative">
                      {isHumanMode ? (
                        <>
                          <textarea 
                            value={manualMsg}
                            onChange={(e) => setManualMsg(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && !e.shiftKey && manualMsg.trim() && !sendingMsg) {
                                e.preventDefault();
                                setSendingMsg(true);
                                await fetch('/api/panel/send-message', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ conversationId: selectedChat.id, message: manualMsg.trim() }),
                                });
                                setManualMsg('');
                                const res = await fetch(\`/api/panel/conversations?id=\${selectedChat.id}\`);
                                const data = await res.json();
                                if (data.messages) setChatMessages(data.messages);
                                setSendingMsg(false);
                              }
                            }}
                            disabled={sendingMsg}
                            className="w-full bg-white border-outline-variant/20 rounded-xl p-4 text-sm focus:ring-primary-container focus:border-primary-container min-h-[100px] resize-none text-black" 
                            placeholder="Take over conversation or write a note..."
                          ></textarea>
                          <div className="absolute bottom-4 right-4 flex gap-2">
                            <button className="p-2 bg-surface-container-highest rounded-lg hover:bg-surface-container-high transition-colors">
                              <span className="material-symbols-outlined text-on-surface-variant text-sm">attach_file</span>
                            </button>
                            <button 
                              disabled={sendingMsg || !manualMsg.trim()}
                              onClick={async () => {
                                if (!manualMsg.trim() || sendingMsg) return;
                                setSendingMsg(true);
                                await fetch('/api/panel/send-message', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ conversationId: selectedChat.id, message: manualMsg.trim() }),
                                });
                                setManualMsg('');
                                const res = await fetch(\`/api/panel/conversations?id=\${selectedChat.id}\`);
                                const data = await res.json();
                                if (data.messages) setChatMessages(data.messages);
                                setSendingMsg(false);
                              }}
                              className="px-6 py-2 bg-gradient-to-r from-primary to-primary-container text-white font-bold text-xs rounded-lg uppercase tracking-widest shadow-md disabled:opacity-50 hover:shadow-lg transition-all"
                            >
                              {sendingMsg ? '...' : 'Send'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full bg-white/50 border border-outline-variant/20 rounded-xl p-4 text-sm text-slate-400 min-h-[100px] flex items-center justify-center">
                          La IA está respondiendo de forma autónoma. Haz clic en 'Tomar Control' en la cabecera para enviar un mensaje manualmente.
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* 5. Notes & Metadata */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Operator Notes */}
                  <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_rgba(25,28,29,0.01)] border-t-2 border-secondary">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-widest">Operator Notes</h4>
                      <span className="material-symbols-outlined text-slate-300 text-sm">edit_note</span>
                    </div>
                    <p className="text-sm text-on-surface-variant italic leading-relaxed">
                      "Mencionó que están evaluando otras 2 plataformas, pero prefiere nuestra integración nativa con SAP. Pendiente de enviar caso de éxito del sector Fintech."
                    </p>
                    <div className="mt-4 pt-4 border-t border-surface-container-low flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-secondary-container"></div>
                      <span className="text-[10px] font-bold text-slate-400">Added by Sarah J. • 2 days ago</span>
                    </div>
                  </div>
                  {/* System Tags */}
                  <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_24px_24px_rgba(25,28,29,0.01)] border-t-2 border-primary-container">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-widest">System Metadata</h4>
                      <span className="material-symbols-outlined text-slate-300 text-sm">label</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low rounded text-[10px] font-bold text-on-surface">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        WEB_DIRECT
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low rounded text-[10px] font-bold text-on-surface">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        REGION_MX
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low rounded text-[10px] font-bold text-on-surface">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        HIGH_VALUE_LEAD
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low rounded text-[10px] font-bold text-on-surface">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        CAMPAIGN_Q3_AUTO
                      </div>
                      <button className="px-3 py-1.5 border border-dashed border-outline-variant rounded text-[10px] font-bold text-slate-400 hover:border-primary-container hover:text-primary-container transition-all">
                        + ADD TAG
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
`;

const finalContent = beforeModal + newModalJsx + afterModal;
fs.writeFileSync('app/panel/panel-client.tsx', finalContent);
console.log('Successfully replaced Chat Modal with EXACT Full Screen Inbox');
