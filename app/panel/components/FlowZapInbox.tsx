'use client';

import React, { useState } from 'react';
import { ConversationsModule } from './02-conversations/ConversationsModule';
import type { ConversationSummary, ConversationDetail, Advisor } from './00-shared/types';

export default function FlowZapInbox() {
  const advisors: Advisor[] = [
    { id: 'bot', name: 'Bot Principal', status: 'Activo' },
    { id: 'agent_1', name: 'Agente Humano 1', status: 'Ausente' },
  ];

  const [conversations, setConversations] = useState<ConversationSummary[]>([
    {
      phone: '5215551234567',
      name: 'Cliente Demo',
      lastMessage: 'Hola, me gustaría más información sobre sus planes.',
      lastMessageAt: 'Ahora',
      unread: 1,
      botPaused: false
    },
    {
      phone: '5215559876543',
      name: 'Maria Demo',
      lastMessage: 'Gracias, los reviso.',
      lastMessageAt: 'Ayer',
      unread: 0,
      botPaused: false
    }
  ]);

  const [details, setDetails] = useState<Record<string, ConversationDetail>>({
    '5215551234567': {
      phone: '+52 1 555 123 4567',
      name: 'Cliente Demo',
      status: 'open',
      botPaused: false,
      assignedTo: 'bot',
      messages: [
        { id: '1', direction: 'in', text: 'Hola, me gustaría más información sobre sus planes.', createdAt: '10:30' },
        { id: '2', direction: 'out', text: '¡Hola! Claro que sí, con gusto te ayudo. ¿Qué tamaño tiene tu equipo?', createdAt: '10:31' }
      ],
      contact: {
        phone: '5215551234567',
        name: 'Cliente Demo',
        tags: ['VIP', 'NUEVO'],
        fields: {
          'Email': 'cliente@demo.com',
          'Empresa': 'Demo Corp'
        }
      }
    },
    '5215559876543': {
      phone: '+52 1 555 987 6543',
      name: 'Maria Demo',
      status: 'open',
      botPaused: false,
      assignedTo: 'agent_1',
      messages: [
        { id: '3', direction: 'in', text: 'Gracias, los reviso.', createdAt: 'Ayer' }
      ],
      contact: {
        phone: '5215559876543',
        name: 'Maria Demo',
        tags: [],
        fields: {}
      }
    }
  });

  const [selectedPhone, setSelectedPhone] = useState<string>('5215551234567');

  const handleSend = (text: string) => {
    if (!selectedPhone || !details[selectedPhone]) return;
    
    const newMsg = {
      id: Date.now().toString(),
      direction: 'out' as const,
      text,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setDetails(prev => ({
      ...prev,
      [selectedPhone]: {
        ...prev[selectedPhone],
        messages: [...prev[selectedPhone].messages, newMsg]
      }
    }));

    setConversations(prev => prev.map(c => {
      if (c.phone === selectedPhone) {
        return { ...c, lastMessage: text, lastMessageAt: 'Ahora' };
      }
      return c;
    }));
  };

  const toggleBot = () => {
    if (!selectedPhone || !details[selectedPhone]) return;
    
    setDetails(prev => ({
      ...prev,
      [selectedPhone]: {
        ...prev[selectedPhone],
        botPaused: !prev[selectedPhone].botPaused
      }
    }));

    setConversations(prev => prev.map(c => {
      if (c.phone === selectedPhone) {
        return { ...c, botPaused: !c.botPaused };
      }
      return c;
    }));
  };

  return (
    <div style={{ height: 'calc(100vh - 140px)' }}>
      <ConversationsModule 
        conversations={conversations}
        selected={details[selectedPhone] || null}
        advisors={advisors}
        onSelect={(phone) => setSelectedPhone(phone)}
        onSend={handleSend}
        onToggleBot={toggleBot}
      />
    </div>
  );
}
