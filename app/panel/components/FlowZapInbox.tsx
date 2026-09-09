'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ConversationsModule } from './02-conversations/ConversationsModule';
import type { ConversationSummary, ConversationDetail, Advisor } from './00-shared/types';

interface FlowZapInboxProps {
  conversationsData: any;
  activeAccountId: string;
  onRefresh: () => void;
  teamAgents?: any[];
}

export default function FlowZapInbox({
  conversationsData,
  activeAccountId,
  onRefresh,
  teamAgents = [],
}: FlowZapInboxProps) {
  // 1. Build Advisors List
  const advisors: Advisor[] = useMemo(() => {
    const list: Advisor[] = [
      { id: 'bot', name: 'Bot Principal', status: 'Activo' },
    ];
    if (Array.isArray(teamAgents)) {
      teamAgents.forEach((agent: any) => {
        list.push({
          id: agent.id || agent.email,
          name: agent.name || agent.email?.split('@')[0] || 'Asesor',
          email: agent.email,
          role: agent.role === 'admin' ? 'Administrador' : 'Asesor',
          status: agent.status || 'Disponible',
        });
      });
    }
    return list;
  }, [teamAgents]);

  // 2. Extract All Conversations (with demo fallback if empty)
  const rawConvs = useMemo(() => {
    const list = [
      ...(conversationsData?.chatting || []),
      ...(conversationsData?.interested || []),
      ...(conversationsData?.bought || []),
    ];
    if (list.length === 0) {
      // Demo conversation matching Captura 2
      return [
        {
          id: 'demo-rifx-marketing',
          customer_name: 'Rifx Marketing',
          phone_number: '593983910712',
          status: 'chatting',
          sales_stage: 'new_lead',
          intent: 'support',
          lead_score: 16,
          urgency_level: 'unknown',
          budget_range: 'No especificado',
          service_interest: 'Ninguno',
          last_objection: null,
          next_action: 'Continuar conversación',
          created_at: '2026-06-11T12:00:00Z',
          updated_at: new Date().toISOString(),
          is_paused: false,
          assigned_to: 'bot',
          notes: '',
          tags: [],
          custom_fields: {},
        },
      ];
    }
    return list;
  }, [conversationsData]);

  // 3. States for Selection, Filters, and Optimistic CRM Updates
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, any>>({});
  const [sendingMsg, setSendingMsg] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const messageCache = useRef<Record<string, any[]>>({});

  // 4. Filter Conversations by Search & Status
  const filteredConvs = useMemo(() => {
    return rawConvs.filter((c: any) => {
      const overrides = optimisticOverrides[c.id] || {};
      const effectiveStatus = overrides.status || c.status || 'chatting';
      const effectiveName = overrides.name || c.customer_name || c.phone_number || '';
      const effectivePhone = overrides.phone_number || c.phone_number || '';

      // Status Filter
      if (statusFilter) {
        if (statusFilter === 'open' && (effectiveStatus === 'bought' || effectiveStatus === 'closed')) return false;
        if (statusFilter === 'closed' && effectiveStatus !== 'bought' && effectiveStatus !== 'closed') return false;
        if (statusFilter === 'chatting' && effectiveStatus !== 'chatting') return false;
        if (statusFilter === 'interested' && effectiveStatus !== 'interested') return false;
        if (statusFilter === 'bought' && effectiveStatus !== 'bought') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = effectiveName.toLowerCase().includes(q);
        const matchPhone = effectivePhone.toLowerCase().includes(q);
        const matchNotes = (c.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchNotes) return false;
      }

      return true;
    });
  }, [rawConvs, optimisticOverrides, statusFilter, searchQuery]);

  // 5. Summaries for Left List
  const conversations: ConversationSummary[] = useMemo(() => {
    return filteredConvs.map((c: any) => {
      const overrides = optimisticOverrides[c.id] || {};
      const name = overrides.name || c.customer_name || c.phone_number || 'Desconocido';
      const phone = overrides.phone_number || c.phone_number || c.id;
      const effectiveStatus = overrides.status || c.status;
      const isPaused = overrides.is_paused !== undefined ? overrides.is_paused : (c.is_paused || c.bot_paused);
      const assignedId = overrides.assigned_to !== undefined ? overrides.assigned_to : c.assigned_to;
      const advisor = advisors.find((a) => a.id === assignedId);

      return {
        id: c.id,
        phone: phone,
        name: name,
        lastMessage: c.last_message_preview || '',
        lastMessageAt: c.updated_at
          ? new Date(c.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '',
        unread: c.unread_count || 0,
        status: effectiveStatus,
        botPaused: isPaused,
        advisorName: advisor?.name,
      };
    });
  }, [filteredConvs, optimisticOverrides, advisors]);

  // Default to first conversation if none selected
  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id || conversations[0].phone);
    }
  }, [conversations, selectedId]);

  // Find currently selected conversation raw record
  const selectedConv = useMemo(() => {
    if (!selectedId) return rawConvs[0] || null;
    return (
      rawConvs.find((c: any) => c.id === selectedId || c.phone_number === selectedId || c.phone === selectedId) ||
      rawConvs[0] ||
      null
    );
  }, [rawConvs, selectedId]);

  // 6. Fetch Messages for Selected Conversation
  useEffect(() => {
    if (!selectedConv || !selectedConv.id) return;
    const convId = selectedConv.id;
    let isMounted = true;

    // Load from cache or clear
    if (messageCache.current[convId]) {
      setMessages(messageCache.current[convId]);
    } else {
      setMessages([]);
    }

    if (convId === 'demo-rifx-marketing') {
      // Simulated demo message
      setMessages([
        {
          id: 'demo-msg-1',
          role: 'user',
          content: 'Hola, me gustaría recibir más información sobre sus servicios de marketing.',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'demo-msg-2',
          role: 'assistant',
          content: '¡Hola! Qué gusto saludarte. Claro que sí, con gusto te explicamos nuestras soluciones integrales de marketing y automatización.',
          created_at: new Date(Date.now() - 1800000).toISOString(),
        },
      ]);
      return;
    }

    const fetchMsgs = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      try {
        const url = `/api/panel/conversations?id=${convId}&_t=${Date.now()}`;
        const res = await fetch(url, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const data = await res.json();
        if (isMounted && data.messages) {
          messageCache.current[convId] = data.messages;
          setMessages(data.messages);
        }
      } catch (err) {
        console.error('Error fetching conversation messages:', err);
      }
    };

    fetchMsgs();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchMsgs();
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedConv]);

  // 7. Detailed Selected Record with Full CRM Intelligence Fields
  const selectedDetail: ConversationDetail | null = useMemo(() => {
    if (!selectedConv) return null;
    const overrides = optimisticOverrides[selectedConv.id] || {};
    const effectiveName = overrides.name || selectedConv.customer_name || selectedConv.phone_number || 'Rifx Marketing';
    const effectivePhone = overrides.phone_number || selectedConv.phone_number || '593983910712';
    const effectiveStage = overrides.sales_stage || selectedConv.sales_stage || 'new_lead';
    const effectiveNotes = overrides.notes !== undefined ? overrides.notes : selectedConv.notes || '';
    const effectiveTags = overrides.tags || selectedConv.tags || [];
    const effectiveAssigned =
      overrides.assigned_to !== undefined ? overrides.assigned_to : selectedConv.assigned_to || 'bot';
    const effectiveStatus = overrides.status || selectedConv.status || 'chatting';
    const isPaused =
      overrides.is_paused !== undefined ? overrides.is_paused : selectedConv.is_paused || selectedConv.bot_paused;

    const leadScore = selectedConv.lead_score !== undefined && selectedConv.lead_score !== null ? selectedConv.lead_score : 16;
    const intent = selectedConv.intent || 'support';
    const urgency = selectedConv.urgency_level || 'unknown';
    const budget = selectedConv.budget_range || 'No especificado';
    const serviceInterest = selectedConv.service_interest || 'Ninguno';
    const lastObjection = selectedConv.last_objection || null;
    const nextAction = selectedConv.next_action || 'Continuar conversación';
    const createdAt = selectedConv.created_at || '2026-06-11T12:00:00Z';
    const updatedAt = selectedConv.updated_at || new Date().toISOString();

    return {
      id: selectedConv.id,
      phone: effectivePhone,
      name: effectiveName,
      status: effectiveStatus,
      botPaused: isPaused,
      assignedTo: effectiveAssigned,
      lead_score: leadScore,
      sales_stage: effectiveStage,
      intent: intent,
      urgency_level: urgency,
      budget_range: budget,
      service_interest: serviceInterest,
      last_objection: lastObjection,
      next_action: nextAction,
      created_at: createdAt,
      updated_at: updatedAt,
      rawConv: {
        ...selectedConv,
        ...overrides,
        notes: effectiveNotes,
        tags: effectiveTags,
        sales_stage: effectiveStage,
        customer_name: effectiveName,
        phone_number: effectivePhone,
        lead_score: leadScore,
      },
      messages: messages
        .filter(
          (m: any) =>
            m.content !== '__SYSTEM_PAUSE__' &&
            m.content !== '__SYSTEM_RESUME__' &&
            m.content !== '__HUMAN_REQUEST__' &&
            m.content !== '__HUMAN_ASK__' &&
            !(m.content && m.content.startsWith('__ORDER_DATA__:')),
        )
        .slice()
        .map((m: any) => ({
          id: m.id || m.message_id || Date.now().toString(),
          direction: m.role === 'user' ? 'in' : 'out',
          text: m.content || m.text || m.body || '',
          createdAt: m.created_at
            ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '',
        })),
      contact: {
        id: selectedConv.id,
        phone: effectivePhone,
        name: effectiveName,
        tags: effectiveTags,
        notes: effectiveNotes,
        fields: selectedConv.custom_fields || {},
      },
    };
  }, [selectedConv, messages, optimisticOverrides]);

  // 8. Handle Send Message
  const handleSend = async (text: string) => {
    if (!selectedConv || sendingMsg) return;

    // Optimistically add message
    const tempId = 'temp-' + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: 'assistant',
        content: text,
        created_at: new Date().toISOString(),
      },
    ]);

    if (selectedConv.id === 'demo-rifx-marketing') return;

    setSendingMsg(true);
    const formData = new FormData();
    formData.append('conversationId', selectedConv.id);
    formData.append('message', text);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      await fetch('/api/panel/send-message', {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'same-origin',
        body: formData,
      });

      // Refetch messages
      const url = `/api/panel/conversations?id=${selectedConv.id}&_t=${Date.now()}`;
      const res = await fetch(url, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.messages) {
        messageCache.current[selectedConv.id] = data.messages;
        setMessages(data.messages);
      }

      onRefresh();
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  // 9. Handle Toggle Bot Pause/Resume
  const toggleBot = async () => {
    if (!selectedConv) return;
    const currentPaused =
      optimisticOverrides[selectedConv.id]?.is_paused !== undefined
        ? optimisticOverrides[selectedConv.id].is_paused
        : selectedConv.is_paused || selectedConv.bot_paused;
    const newPaused = !currentPaused;

    setOptimisticOverrides((prev) => ({
      ...prev,
      [selectedConv.id]: {
        ...(prev[selectedConv.id] || {}),
        is_paused: newPaused,
      },
    }));

    if (selectedConv.id === 'demo-rifx-marketing') return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      await fetch('/api/panel/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          paused: newPaused,
        }),
      });
      onRefresh();
    } catch (err) {
      console.error('Error toggling bot status:', err);
    }
  };

  // 10. Handle Toggle Closed/Open Status
  const handleToggleClosed = async () => {
    if (!selectedConv) return;
    const currentStatus = optimisticOverrides[selectedConv.id]?.status || selectedConv.status;
    const newStatus = currentStatus === 'bought' || currentStatus === 'closed' ? 'chatting' : 'bought';

    setOptimisticOverrides((prev) => ({
      ...prev,
      [selectedConv.id]: {
        ...(prev[selectedConv.id] || {}),
        status: newStatus,
      },
    }));

    if (selectedConv.id === 'demo-rifx-marketing') return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      await fetch('/api/panel/conversations', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: selectedConv.id,
          status: newStatus,
        }),
      });
      onRefresh();
    } catch (err) {
      console.error('Error toggling closed status:', err);
    }
  };

  // 11. Handle Assign Advisor
  const handleAssign = async (advisorId: string | null) => {
    if (!selectedConv) return;
    const targetAdvisor = advisorId === 'bot' ? null : advisorId;

    setOptimisticOverrides((prev) => ({
      ...prev,
      [selectedConv.id]: {
        ...(prev[selectedConv.id] || {}),
        assigned_to: targetAdvisor || 'bot',
      },
    }));

    if (selectedConv.id === 'demo-rifx-marketing') return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      await fetch('/api/panel/conversations', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: selectedConv.id,
          assigned_to: targetAdvisor,
        }),
      });
      onRefresh();
    } catch (err) {
      console.error('Error assigning advisor:', err);
    }
  };

  // 12. Handle Update Contact (From Modal)
  const handleUpdateContact = async (updates: {
    name?: string;
    phone_number?: string;
    sales_stage?: string;
    notes?: string;
    tags?: string[];
  }) => {
    if (!selectedConv) return;

    // Optimistically update
    setOptimisticOverrides((prev) => ({
      ...prev,
      [selectedConv.id]: {
        ...(prev[selectedConv.id] || {}),
        ...updates,
      },
    }));

    if (selectedConv.id === 'demo-rifx-marketing') return;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/panel/conversations', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: selectedConv.id,
          ...updates,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        console.error('Failed to update contact:', errData.error);
      }
      onRefresh();
    } catch (err) {
      console.error('Error saving contact updates:', err);
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 150px)' }}>
      <ConversationsModule
        conversations={conversations}
        selected={selectedDetail}
        advisors={advisors}
        onSelect={(idOrPhone) => setSelectedId(idOrPhone)}
        onSearch={setSearchQuery}
        onStatusFilter={setStatusFilter}
        onSend={handleSend}
        onToggleBot={toggleBot}
        onToggleClosed={handleToggleClosed}
        onAssign={handleAssign}
        onUpdateContact={handleUpdateContact}
      />
    </div>
  );
}
