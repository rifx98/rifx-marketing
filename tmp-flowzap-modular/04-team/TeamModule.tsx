'use client';
import React from 'react';
import type { Advisor } from '../00-shared/types';
import { Avatar, EmptyState, StatusPill } from '../00-shared/ui';
import styles from './team.module.css';

export function TeamModule({ members, onCreate, onStatusChange, onEdit }: { members: Advisor[]; onCreate?:()=>void; onStatusChange?:(id:string,status:string)=>void; onEdit?:(m:Advisor)=>void }) {
  return <div className={styles.page}><div className={styles.top}><div><h3>Equipo de atención</h3><p>Administra asesores, supervisores y disponibilidad.</p></div><button onClick={onCreate}>+ Nuevo usuario</button></div>{members.length?<div className={styles.grid}>{members.map((m)=><article className={styles.card} key={m.id}><div className={styles.head}><Avatar name={m.name} large/><div><h3>{m.name}</h3><p>{m.email || 'Sin correo'}</p></div></div><div className={styles.meta}><StatusPill tone={m.role==='Administrador'?'premium':'neutral'}>{m.role || 'Asesor'}</StatusPill><select value={m.status || 'Disponible'} onChange={(e)=>onStatusChange?.(m.id,e.target.value)}><option>Disponible</option><option>Ocupado</option><option>Desconectado</option></select></div><button className={styles.edit} onClick={()=>onEdit?.(m)}>Editar</button></article>)}</div>:<EmptyState icon="👨‍💼" title="No hay miembros del equipo"/>}</div>;
}
