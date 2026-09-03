'use client';
import React, { useMemo, useState } from 'react';
import type { Advisor, ConversationDetail, ConversationSummary } from '../00-shared/types';
import { Avatar, EmptyState, Tag } from '../00-shared/ui';
import styles from './conversations.module.css';

export function ConversationsModule({ conversations, selected, advisors, onSelect, onSearch, onStatusFilter, onSend, onToggleBot, onToggleClosed, onAssign, onEditContact }: {
  conversations: ConversationSummary[];
  selected?: ConversationDetail | null;
  advisors: Advisor[];
  onSelect?: (phone: string) => void;
  onSearch?: (q: string) => void;
  onStatusFilter?: (status: string) => void;
  onSend?: (text: string) => void;
  onToggleBot?: () => void;
  onToggleClosed?: () => void;
  onAssign?: (advisorId: string | null) => void;
  onEditContact?: () => void;
}) {
  const [draft, setDraft] = useState('');
  const name = selected?.contact?.name || selected?.name || selected?.phone || '';
  const fields = useMemo(() => Object.entries(selected?.contact?.fields || {}), [selected]);
  const send = () => { const value = draft.trim(); if (!value) return; onSend?.(value); setDraft(''); };

  return <div className={styles.grid}>
    <aside className={styles.listPanel}>
      <div className={styles.search}><input placeholder="Buscar cliente o mensaje..." onChange={(e)=>onSearch?.(e.target.value)} /><select onChange={(e)=>onStatusFilter?.(e.target.value)}><option value="">Todas</option><option value="open">Abiertas</option><option value="closed">Cerradas</option></select></div>
      <div className={styles.list}>{conversations.length ? conversations.map((c) => <button key={c.phone} className={`${styles.row} ${selected?.phone===c.phone?styles.active:''}`} onClick={()=>onSelect?.(c.phone)}><Avatar name={c.name || c.phone}/><span className={styles.rowMain}><span><strong>{c.name || c.phone}</strong><time>{c.lastMessageAt || ''}</time></span><small>{c.lastMessage || 'Sin mensajes'}</small><em>{c.botPaused?'👤 Humano':'🤖 Bot'}{c.advisorName?` · ${c.advisorName}`:''}{c.whatsappAccountName?` · ${c.whatsappAccountName}`:''}</em></span>{c.unread ? <b className={styles.unread}>{c.unread}</b> : null}</button>) : <EmptyState icon="📭" title="Sin conversaciones" text="Las conversaciones entrantes aparecerán aquí." />}</div>
    </aside>

    <section className={styles.chat}>
      {!selected ? <EmptyState icon="💬" title="Selecciona una conversación" text="Desde aquí puedes responder manualmente y pausar o reactivar el bot." /> : <>
        <header className={styles.chatHeader}><div className={styles.person}><Avatar name={name}/><div><strong>{name}</strong><small>{selected.phone} · {selected.botPaused?'👤 Atención humana':'🤖 Bot activo'}</small></div></div><div className={styles.headerActions}><button onClick={onToggleBot}>{selected.botPaused?'▶ Reactivar bot':'⏸ Pausar bot'}</button><button className={styles.ghost} onClick={onToggleClosed}>{selected.status==='closed'?'Reabrir':'Cerrar'}</button></div></header>
        <div className={styles.messages}>{selected.messages.length ? selected.messages.map((m,i)=><div key={m.id || i} className={`${styles.bubble} ${m.direction==='in'?styles.in:m.direction==='out'?styles.out:styles.system}`}>{m.media?.url && <div className={styles.media}>📎 {m.media.filename || m.media.type || 'archivo'}</div>}{m.text && <div>{m.text}</div>}<small>{m.createdAt || ''}{m.status?` · ${m.status}`:''}</small></div>) : <EmptyState title="Sin mensajes todavía"/>}</div>
        <div className={styles.compose}><input value={draft} onChange={(e)=>setDraft(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter')send();}} placeholder="Escribe un mensaje..."/><button onClick={send}>Enviar</button></div>
      </>}
    </section>

    <aside className={styles.info}>
      {!selected ? <EmptyState icon="👤" title="Información del contacto"/> : <>
        <div className={styles.contactHead}><Avatar name={name} large/><h3>{name}</h3><p>{selected.phone}</p></div>
        <Info title="Número de WhatsApp"><p>{selected.whatsappAccountName || 'Predeterminado'}</p></Info>
        <Info title="Asignado a"><select value={selected.assignedTo || ''} onChange={(e)=>onAssign?.(e.target.value || null)}><option value="">Sin asignar</option>{advisors.map((a)=><option key={a.id} value={a.id}>{a.name} · {a.status || ''}</option>)}</select></Info>
        <Info title="Etiquetas"><div className={styles.tags}>{(selected.contact?.tags || []).map((t)=><Tag key={t}>{t}</Tag>)}{!(selected.contact?.tags||[]).length && <span className={styles.muted}>Sin etiquetas</span>}</div></Info>
        <Info title="Notas"><p>{selected.contact?.notes || 'Sin notas'}</p></Info>
        <Info title="Campos">{fields.length ? fields.map(([k,v])=><div className={styles.kv} key={k}><span>{k}</span><strong>{v}</strong></div>) : <p className={styles.muted}>Sin campos personalizados</p>}</Info>
        <button className={styles.edit} onClick={onEditContact}>Editar contacto</button>
      </>}
    </aside>
  </div>;
}

function Info({ title, children }: { title: string; children: React.ReactNode }) { return <div className={styles.infoBlock}><label>{title}</label>{children}</div>; }
