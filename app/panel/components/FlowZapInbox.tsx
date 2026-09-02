'use client';

import React, { useState } from 'react';
import { ConversationsModule } from './02-conversations/ConversationsModule';
import type { ConversationSummary, ConversationDetail, Advisor } from './00-shared/types';

export default function FlowZapInbox() {
  const advisors: Advisor[] = [
    { id: 'bot', name: 'Bot Principal', status: 'Activo' },
    { id: 'agent_1', name: 'Agente Humano 1', status: 'Ausente' },
  ];

  const mockConversations: ConversationSummary[] = [
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
  ];

  const mockDetails: Record<string, ConversationDetail> = {
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
  };

  const [selectedPhone, setSelectedPhone] = useState<string>('5215551234567');

  return (
    <div style={{ height: 'calc(100vh - 140px)' }}>
      <ConversationsModule 
        conversations={mockConversations}
        selected={mockDetails[selectedPhone] || null}
        advisors={advisors}
        onSelect={(phone) => setSelectedPhone(phone)}
        onSend={(text) => alert(`Enviando: ${text}`)}
      />
    </div>
  );
}
