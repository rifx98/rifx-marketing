import fs from 'fs';

let content = fs.readFileSync('app/panel/panel-client.tsx', 'utf8');

const modalStart = content.indexOf('{/* ----------------- CHAT MODAL (Portal to body) ----------------- */}');
if (modalStart === -1) {
    console.error('Modal start not found');
    process.exit(1);
}

// Find the end of the createPortal block. It ends with 'document.body\n    )}'
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
            className="fixed inset-0 z-[9999] bg-background text-on-surface font-body overflow-y-auto"
          >
            {/* TopAppBar */}
            <header className="bg-[#f8f9fa] flex justify-between items-center w-full px-8 h-16 sticky top-0 z-50 shadow-[0_24px_24px_rgba(25,28,29,0.04)]">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedChat(null)} className="p-2 hover:bg-surface-container-low rounded-full transition-colors flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-surface">arrow_back</span>
                </button>
                <h2 className="font-['Manrope'] font-bold tracking-tight text-xl text-[#000080]">Inbox: {selectedChat.name || 'Usuario'}</h2>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
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
                    className={\`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 \${
                      isHumanMode
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
                    }\`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{isHumanMode ? 'smart_toy' : 'person'}</span>
                    {isHumanMode ? 'Devolver a IA' : 'Tomar Control'}
                  </button>
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
                    <div className="w-24 h-24 rounded-full bg-primary-container flex items-center justify-center text-white text-3xl font-bold mb-4">
                      {selectedChat.name?.substring(0, 2).toUpperCase() || 'U'}
                    </div>
                    <h3 className="font-display text-2xl font-extrabold text-on-surface tracking-tight">{selectedChat.name || 'Usuario'}</h3>
                    <div className="mt-4 px-4 py-1.5 bg-primary-container text-white text-xs font-bold rounded-full uppercase tracking-widest">
                      {selectedChat.status || 'Chatting'}
                    </div>

                    <div className="grid grid-cols-3 gap-3 w-full mt-8">
                      {!selectedChat.status?.includes('chatting') && (
                        <button onClick={async () => {
                          await fetch('/api/panel/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedChat.id, status: 'chatting' }) });
                          setSelectedChat({ ...selectedChat, status: 'chatting' });
                          const res = await fetch('/api/panel/conversations');
                          setConversationsData(await res.json());
                        }} className="flex flex-col items-center justify-center p-3 rounded-lg bg-surface-container-low hover:bg-primary-container hover:text-white transition-all group">
                          <span className="material-symbols-outlined text-primary-container group-hover:text-white">chat</span>
                          <span className="text-[10px] mt-1 font-bold uppercase">Chateando</span>
                        </button>
                      )}
                      {!selectedChat.status?.includes('interested') && (
                        <button onClick={async () => {
                          await fetch('/api/panel/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedChat.id, status: 'interested' }) });
                          setSelectedChat({ ...selectedChat, status: 'interested' });
                          const res = await fetch('/api/panel/conversations');
                          setConversationsData(await res.json());
                        }} className="flex flex-col items-center justify-center p-3 rounded-lg bg-surface-container-low hover:bg-primary-container hover:text-white transition-all group">
                          <span className="material-symbols-outlined text-primary-container group-hover:text-white">star</span>
                          <span className="text-[10px] mt-1 font-bold uppercase">Interesado</span>
                        </button>
                      )}
                      {!selectedChat.status?.includes('bought') && (
                        <button onClick={async () => {
                          await fetch('/api/panel/conversations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selectedChat.id, status: 'bought' }) });
                          setSelectedChat({ ...selectedChat, status: 'bought' });
                          const res = await fetch('/api/panel/conversations');
                          setConversationsData(await res.json());
                        }} className="flex flex-col items-center justify-center p-3 rounded-lg bg-surface-container-low hover:bg-primary-container hover:text-white transition-all group">
                          <span className="material-symbols-outlined text-primary-container group-hover:text-white">check_circle</span>
                          <span className="text-[10px] mt-1 font-bold uppercase">Compró</span>
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                {/* 2. AI Intelligence Insights (Static for now) */}
                <section className="bg-primary-container/5 backdrop-blur-md rounded-xl p-6 border-l-4 border-primary-container">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-primary-container">psychology</span>
                    <h4 className="font-display font-bold text-lg text-primary-container tracking-tight">AI Intelligence Profile</h4>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Propensity to Convert</span>
                        <span className="text-xl font-extrabold text-primary-container">88%</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full" style={{ width: '88%' }}></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white/50 rounded-lg">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Sentiment Analysis</p>
                        <p className="text-sm font-semibold text-on-surface">Consistently Positive</p>
                      </div>
                      <span className="material-symbols-outlined text-emerald-600 scale-125" style={{ fontVariationSettings: "'FILL' 1" }}>sentiment_very_satisfied</span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Column 2: Timeline & Notes */}
              <div className="col-span-12 lg:col-span-8 space-y-8">
                {/* 3. Communication Timeline */}
                <section className="bg-surface-container-lowest rounded-xl shadow-[0_24px_24px_rgba(25,28,29,0.02)] flex flex-col h-[600px]">
                  <div className="p-6 border-b border-surface-container-low flex justify-between items-center">
                    <h4 className="font-display font-bold text-lg flex items-center gap-2">
                      <span className={\`w-2 h-2 rounded-full animate-pulse \${isHumanMode ? 'bg-orange-500' : 'bg-emerald-500'}\`}></span>
                      Communication Timeline
                    </h4>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-surface-container text-[10px] font-bold rounded">WhatsApp</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide" ref={chatContainerRef}>
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
                              <div className="relative flex items-center justify-center my-6">
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
                  
                  {/* Chat Input */}
                  <div className="p-6 bg-surface-container-low/50 border-t border-surface-container-low">
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
                            className="w-full bg-white border-outline-variant/20 rounded-xl p-4 text-sm focus:ring-primary-container focus:border-primary-container min-h-[100px] resize-none" 
                            placeholder="Toma el control de la conversación..."
                          ></textarea>
                          <div className="absolute bottom-4 right-4 flex gap-2">
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
                              className="px-6 py-2 bg-gradient-to-r from-primary to-primary-container text-white font-bold text-xs rounded-lg uppercase tracking-widest shadow-md disabled:opacity-50"
                            >
                              {sendingMsg ? 'Enviando...' : 'Send'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full bg-white/50 border-outline-variant/20 rounded-xl p-4 text-sm text-slate-400 min-h-[100px] flex items-center justify-center">
                          La IA está respondiendo de forma autónoma. Haz clic en 'Tomar Control' arriba para enviar un mensaje manualmente.
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
`;

const finalContent = beforeModal + newModalJsx;
fs.writeFileSync('app/panel/panel-client.tsx', finalContent);
console.log('Successfully replaced Chat Modal with Full Screen Inbox');
