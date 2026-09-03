'use client';

import React, { useState, useMemo } from 'react';
import { ConversationsModule } from './02-conversations/ConversationsModule';
import type { ConversationSummary, ConversationDetail, Advisor } from './00-shared/types';

export default function FlowZapInbox({ conversationsData, activeAccountId, onRefresh }: { conversationsData: any, activeAccountId: string, onRefresh: () => void }) {
  const advisors: Advisor[] = [
    { id: 'bot', name: 'Bot Principal', status: 'Activo' },
  ];

  const allConvs = useMemo(() => {
    return ((conversationsData?.chatting || []).concat(conversationsData?.interested || []).concat(conversationsData?.bought || []));
  }, [conversationsData]);

  const conversations: ConversationSummary[] = useMemo(() => {
    return allConvs.map((c: any) => ({
      phone: c.phone || c.id,
      name: c.name || c.phone || 'Desconocido',
      lastMessage: c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1].text : 'Sin mensajes',
      lastMessageAt: c.messages && c.messages.length > 0 ? new Date(c.messages[c.messages.length - 1].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      unread: 0,
      botPaused: c.bot_paused
    }));
  }, [allConvs]);

  const details: Record<string, ConversationDetail> = useMemo(() => {
    const map: Record<string, ConversationDetail> = {};
    allConvs.forEach((c: any) => {
      const p = c.phone || c.id;
      map[p] = {
        phone: p,
        name: c.name || p,
        status: 'open',
        botPaused: c.bot_paused,
        assignedTo: 'bot',
        messages: (c.messages || []).map((m: any) => ({
          id: m.id || m.message_id || Date.now().toString(),
          direction: m.direction === 'inbound' ? 'in' : 'out',
          text: m.text || m.body || '',
          createdAt: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })),
        contact: {
          phone: p,
          name: c.name,
          tags: [],
          fields: {}
        }
      };
    });
    return map;
  }, [allConvs]);

  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [sendingMsg, setSendingMsg] = useState(false);

  // Default to first conversation if none selected
  React.useEffect(() => {
    if (!selectedPhone && conversations.length > 0) {
      setSelectedPhone(conversations[0].phone);
    }
  }, [conversations, selectedPhone]);

  const handleSend = async (text: string) => {
    if (!selectedPhone || !details[selectedPhone] || sendingMsg) return;
    
    // Find internal ID for the selected conversation
    const conv = allConvs.find((c: any) => c.phone === selectedPhone || c.id === selectedPhone);
    if (!conv) return;

    setSendingMsg(true);
    const formData = new FormData();
    formData.append('conversationId', conv.id);
    formData.append('message', text);

    try {
      const token = localStorage.getItem('token');
      await fetch('/api/panel/send-message', {
        method: 'POST',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: formData
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMsg(false);
    }
  };

  const toggleBot = async () => {
    if (!selectedPhone || !details[selectedPhone]) return;
    
    const conv = allConvs.find((c: any) => c.phone === selectedPhone || c.id === selectedPhone);
    if (!conv) return;

    try {
      const token = localStorage.getItem('token');
      await fetch('/api/panel/contacts', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          id: conv.id,
          bot_paused: !conv.bot_paused
        })
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 140px)' }}>
      <ConversationsModule 
        conversations={conversations}
        selected={selectedPhone ? (details[selectedPhone] || null) : null}
        advisors={advisors}
        onSelect={(phone) => setSelectedPhone(phone)}
        onSend={handleSend}
        onToggleBot={toggleBot}
      />
    </div>
  );
}
