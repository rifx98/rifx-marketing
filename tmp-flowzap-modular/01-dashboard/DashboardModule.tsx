'use client';
import React from 'react';
import { EmptyState, StatCard, StatusPill } from '../00-shared/ui';
import styles from './dashboard.module.css';

export type DashboardData = {
  conversations: number; unread: number; contacts: number; human: number; messagesToday: number; open: number;
  recent: Array<{ phone: string; name?: string; lastMessage?: string; lastMessageAt?: string }>;
  system: { flowEngine: boolean; inbox: boolean; webhookToken: boolean; metaSignature: boolean; whatsapp: boolean; ai: boolean; aiLabel?: string };
};

export function DashboardModule({ data, onOpenConversation, onOpenWhatsAppSettings, onOpenAI }: {
  data: DashboardData;
  onOpenConversation?: (phone: string) => void;
  onOpenWhatsAppSettings?: () => void;
  onOpenAI?: () => void;
}) {
  const checks = [
    ['Motor de flujos', data.system.flowEngine, 'Funcionando'],
    ['Bandeja y CRM', data.system.inbox, 'Funcionando'],
    ['Token de verificación', data.system.webhookToken, data.system.webhookToken ? 'Configurado' : 'Pendiente'],
    ['Firma de Meta', data.system.metaSignature, data.system.metaSignature ? 'Configurada' : 'Pendiente'],
    ['WhatsApp Cloud API', data.system.whatsapp, data.system.whatsapp ? 'Conectado' : 'Modo demo'],
    ['FlowZap AI', data.system.ai, data.system.ai ? (data.system.aiLabel || 'Activo') : 'Opcional · desactivado'],
  ] as const;

  return <div className={styles.page}>
    <div className={styles.stats}>
      <StatCard icon="💬" label="Conversaciones" value={data.conversations} sub="Total registradas" />
      <StatCard icon="📥" label="Pendientes" value={data.unread} sub="Mensajes sin leer" />
      <StatCard icon="👥" label="Contactos" value={data.contacts} sub="En tu CRM" />
      <StatCard icon="👤" label="Con asesor" value={data.human} sub="Bot pausado" />
      <StatCard icon="✉️" label="Mensajes hoy" value={data.messagesToday} sub="Entrantes y salientes" />
      <StatCard icon="🟢" label="Abiertas" value={data.open} sub="Conversaciones activas" />
    </div>
    <div className={styles.columns}>
      <section className={styles.card}>
        <header><div><h3>Actividad reciente</h3><p>Últimas conversaciones</p></div></header>
        {data.recent.length ? <div className={styles.recentList}>{data.recent.map((item) => <button key={item.phone} className={styles.recentRow} onClick={() => onOpenConversation?.(item.phone)}><span className={styles.avatar}>{(item.name || item.phone).slice(0,2).toUpperCase()}</span><span className={styles.recentMain}><strong>{item.name || item.phone}</strong><small>{item.lastMessage || 'Sin mensajes'}</small></span><time>{item.lastMessageAt || ''}</time></button>)}</div> : <EmptyState title="Aún no hay conversaciones" text="Cuando conectes WhatsApp aparecerán aquí." />}
      </section>
      <section className={styles.card}>
        <header><div><h3>Estado del sistema</h3><p>Preparación de la integración</p></div></header>
        <div className={styles.checkList}>{checks.map(([label, ok, value]) => <div key={label} className={styles.checkRow}><span className={ok ? styles.ok : styles.pending}>{ok ? '✓' : '!'}</span><div><strong>{label}</strong><small>{value}</small></div></div>)}</div>
        <div className={styles.actions}><button onClick={onOpenWhatsAppSettings}>Configurar WhatsApp</button><button className={styles.secondary} onClick={onOpenAI}>🧠 FlowZap AI</button></div>
        {!data.system.whatsapp && <StatusPill tone="warning">Modo demo</StatusPill>}
      </section>
    </div>
  </div>;
}
