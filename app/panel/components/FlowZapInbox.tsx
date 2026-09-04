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
      phone: c.id, // Using id as the unique key to match with selectedPhone
      name: c.customer_name || c.phone_number || 'Desconocido',
      lastMessage: '',
      lastMessageAt: c.updated_at ? new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      unread: 0,
      botPaused: c.is_paused || c.bot_paused
    }));
  }, [allConvs]);

  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  // Default to first conversation if none selected
  React.useEffect(() => {
    if (!selectedPhone && conversations.length > 0) {
      setSelectedPhone(conversations[0].phone);
    }
  }, [conversations, selectedPhone]);

  // Fetch messages for selected conversation
  React.useEffect(() => {
    if (!selectedPhone) return;
    let isMounted = true;
    const token = localStorage.getItem('token');
    
    fetch(`/api/panel/conversations?id=${selectedPhone}`, {
      headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    })
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.messages) {
          setMessages(data.messages);
        }
      })
      .catch(console.error);

    return () => { isMounted = false; };
  }, [selectedPhone]);

  const selectedConv = useMemo(() => {
    return allConvs.find((c: any) => c.id === selectedPhone) || null;
  }, [allConvs, selectedPhone]);

  const selectedDetail: ConversationDetail | null = useMemo(() => {
    if (!selectedConv) return null;
    return {
      phone: selectedConv.phone_number || selectedConv.id,
      name: selectedConv.customer_name || selectedConv.phone_number || 'Desconocido',
      status: 'open',
      botPaused: selectedConv.is_paused || selectedConv.bot_paused,
      assignedTo: 'bot',
      messages: messages
        .filter((m: any) => m.content !== '__SYSTEM_PAUSE__' && m.content !== '__SYSTEM_RESUME__' && m.content !== '__HUMAN_REQUEST__' && m.content !== '__HUMAN_ASK__' && !(m.content && m.content.startsWith('__ORDER_DATA__:')))
        .slice()
        .reverse()
        .map((m: any) => ({
        id: m.id || m.message_id || Date.now().toString(),
        direction: m.role === 'user' ? 'in' : 'out',
        text: m.content || m.text || m.body || '',
        createdAt: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })),
      contact: {
        phone: selectedConv.phone_number || selectedConv.id,
        name: selectedConv.customer_name,
        tags: [],
        fields: {}
      }
    };
  }, [selectedConv, messages]);



  const handleSend = async (text: string) => {
    if (!selectedPhone || !selectedDetail || sendingMsg) return;
    
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
    if (!selectedPhone || !selectedDetail) return;
    
    const conv = allConvs.find((c: any) => c.phone === selectedPhone || c.id === selectedPhone);
    if (!conv) return;

    try {
      const token = localStorage.getItem('token');
      await fetch('/api/panel/pause', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          conversationId: conv.id,
          paused: !selectedDetail.botPaused
        })
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 150px)' }}>
      <ConversationsModule 
        conversations={conversations}
        selected={selectedDetail}
        advisors={advisors}
        onSelect={(phone) => setSelectedPhone(phone)}
        onSend={handleSend}
        onToggleBot={toggleBot}
      />
    </div>
  );
}
