'use client';
import React from 'react';
import { ConversationsModule } from '../02-conversations/ConversationsModule';

/**
 * EJEMPLO SOLAMENTE.
 * La idea es que el CRM transforme SUS datos al shape visual del componente.
 * No muevas lógica de negocio al componente visual.
 */
export function ConversationsAdapterExample({ crm }: { crm: any }) {
  return <ConversationsModule
    conversations={crm.conversations}
    selected={crm.selectedConversation}
    advisors={crm.advisors}
    onSelect={crm.selectConversation}
    onSearch={crm.searchConversations}
    onStatusFilter={crm.filterConversations}
    onSend={crm.sendManualWhatsAppMessage}
    onToggleBot={crm.toggleConversationBot}
    onToggleClosed={crm.toggleConversationClosed}
    onAssign={crm.assignAdvisor}
    onEditContact={crm.openContactEditor}
  />;
}
