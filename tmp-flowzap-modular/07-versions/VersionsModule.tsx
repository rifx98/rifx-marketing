'use client';
import React from 'react';
import { EmptyState, StatusPill } from '../00-shared/ui';
import styles from './versions.module.css';

export type FlowVersionRow={id:string;createdAt:string;flowName:string;label?:string;kind:'draft'|'published'|'restored'|string;flowVersion:number;createdBy?:string};
export function VersionsModule({ versions, onRestore, onOpenBuilder }: {versions:FlowVersionRow[];onRestore?:(id:string)=>void;onOpenBuilder?:()=>void}){return <div className={styles.page}><div className={styles.top}><div><h3>Historial de versiones</h3><p>Guardar, publicar y restaurar sin perder historial.</p></div><button onClick={onOpenBuilder}>🤖 Abrir constructor</button></div><div className={styles.card}><table><thead><tr><th>Fecha</th><th>Bot</th><th>Tipo</th><th>Versión</th><th>Usuario</th><th></th></tr></thead><tbody>{versions.length?versions.map((v)=><tr key={v.id}><td>{v.createdAt}</td><td><strong>{v.flowName}</strong><small>{v.label}</small></td><td><StatusPill tone={v.kind==='published'?'success':v.kind==='restored'?'premium':'neutral'}>{v.kind}</StatusPill></td><td>v{v.flowVersion}</td><td>{v.createdBy || '—'}</td><td><button onClick={()=>onRestore?.(v.id)}>Restaurar</button></td></tr>):<tr><td colSpan={6}><EmptyState icon="🗂️" title="Aún no hay versiones" text="Se crea una versión cuando guardas o publicas un flujo."/></td></tr>}</tbody></table></div></div>}
