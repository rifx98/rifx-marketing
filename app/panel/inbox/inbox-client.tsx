'use client';

import React, { useState, useEffect } from 'react';

export default function InboxClient() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/panel/conversations');
      const data = await res.json();
      if (Array.isArray(data)) {
        // Only show conversations in human mode
        setConversations(data.filter(c => c.is_human_mode));
      }
    } catch (e) {
      console.error('Error fetching convs:', e);
    } finally {
      setLoading(false);
    }
  };

  const reactivateBot = async (convId: string) => {
    try {
      await fetch('/api/panel/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: convId, action: 'reactivate' })
      });
      setSelectedConv(null);
      fetchConversations();
    } catch (e) {
      console.error(e);
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedConv) return;
    
    // Optimistic
    const tempMsg = { id: Date.now(), role: 'assistant', content: replyText, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);
    setReplyText('');

    try {
      await fetch('/api/panel/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedConv.phone_number, text: tempMsg.content })
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-full w-full bg-slate-50">
      {/* Sidebar - Lista de conversaciones */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600">inbox</span> Bandeja
          </h2>
          <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">{conversations.length}</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="text-center text-slate-400 text-sm mt-10">Cargando...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-slate-400 text-sm mt-10 p-4">No hay clientes esperando atención humana.</div>
          ) : (
            conversations.map(conv => (
              <div 
                key={conv.id} 
                onClick={() => setSelectedConv(conv)}
                className={`p-3 rounded-xl cursor-pointer transition-colors ${selectedConv?.id === conv.id ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50 border border-transparent'}`}
              >
                <div className="font-bold text-slate-800 flex justify-between items-center">
                  +{conv.phone_number}
                  {conv.flow_variables?.nombre && <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{conv.flow_variables.nombre}</span>}
                </div>
                <div className="text-xs text-slate-500 mt-1">Esperando atención...</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Area - Chat */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 relative">
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-20">forum</span>
            <p>Selecciona una conversación para empezar a chatear</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                  {selectedConv.flow_variables?.nombre ? selectedConv.flow_variables.nombre[0].toUpperCase() : 'C'}
                </div>
                <div>
                  <div className="font-bold text-slate-800">{selectedConv.flow_variables?.nombre || `+${selectedConv.phone_number}`}</div>
                  <div className="text-xs text-green-600 font-medium">Modo Asesor (Bot Pausado)</div>
                </div>
              </div>
              <button 
                onClick={() => reactivateBot(selectedConv.id)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 flex items-center gap-2 transition-transform hover:scale-105"
              >
                <span className="material-symbols-outlined text-sm">smart_toy</span> Reactivar Bot
              </button>
            </div>

            {/* Chat Messages Placeholder */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-lg text-center mx-auto max-w-md border border-yellow-200 shadow-sm">
                El bot ha sido pausado. Ahora tú tienes el control de esta conversación.
              </div>
              
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'assistant' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-2xl p-4 shadow-sm ${m.role === 'assistant' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-sm'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
              <div className="flex gap-2 max-w-4xl mx-auto">
                <input 
                  type="text" 
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendReply()}
                  placeholder="Escribe un mensaje al cliente..."
                  className="flex-1 border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all shadow-sm"
                />
                <button 
                  onClick={sendReply}
                  disabled={!replyText.trim()}
                  className="bg-indigo-600 text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-md transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
