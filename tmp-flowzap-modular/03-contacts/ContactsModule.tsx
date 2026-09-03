'use client';
import React, { useState } from 'react';
import type { Contact } from '../00-shared/types';
import { Avatar, EmptyState, Tag } from '../00-shared/ui';
import styles from './contacts.module.css';

export function ContactsModule({ contacts, onSearch, onEdit, onCreate }: { contacts: Contact[]; onSearch?: (q:string)=>void; onEdit?: (contact:Contact)=>void; onCreate?:()=>void }) {
  const [q,setQ]=useState('');
  return <div className={styles.page}><div className={styles.toolbar}><input value={q} onChange={(e)=>{setQ(e.target.value);onSearch?.(e.target.value);}} placeholder="Buscar nombre, teléfono o etiqueta..."/><button onClick={onCreate}>+ Nuevo contacto</button></div><div className={styles.card}><table><thead><tr><th>Contacto</th><th>Teléfono</th><th>Etiquetas</th><th>Última actividad</th><th></th></tr></thead><tbody>{contacts.length?contacts.map((c)=><tr key={c.id || c.phone}><td><div className={styles.person}><Avatar name={c.name || c.phone}/><strong>{c.name || 'Sin nombre'}</strong></div></td><td>{c.phone}</td><td><div className={styles.tags}>{(c.tags||[]).slice(0,4).map((t)=><Tag key={t}>{t}</Tag>)}{!(c.tags||[]).length&&<span>—</span>}</div></td><td>{c.lastSeenAt || '—'}</td><td><button className={styles.ghost} onClick={()=>onEdit?.(c)}>Editar</button></td></tr>):<tr><td colSpan={5}><EmptyState icon="👥" title="No hay contactos todavía"/></td></tr>}</tbody></table></div></div>;
}
