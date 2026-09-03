'use client';
import React from 'react';
import styles from './builder.module.css';

export type PaletteItem = { type:string; icon:string; name:string; description:string };

export const DEFAULT_PALETTE: PaletteItem[] = [
  {type:'start',icon:'▶️',name:'Inicio',description:'Punto inicial'},
  {type:'message',icon:'💬',name:'Mensaje',description:'Enviar texto'},
  {type:'menu',icon:'📋',name:'Menú',description:'Opciones numeradas'},
  {type:'buttons',icon:'🔘',name:'Botones',description:'Acciones rápidas'},
  {type:'question',icon:'✍️',name:'Pregunta',description:'Guardar respuesta'},
  {type:'condition',icon:'🔀',name:'Condición',description:'IF / ELSE'},
  {type:'media',icon:'🖼️',name:'Multimedia',description:'Imagen, video o PDF'},
  {type:'tag',icon:'🏷️',name:'Etiqueta',description:'Agregar o quitar tags'},
  {type:'wait',icon:'⏳',name:'Espera',description:'Pausa programada'},
  {type:'human',icon:'👤',name:'Humano',description:'Pasar a asesor'},
  {type:'ai',icon:'🧠',name:'IA Premium',description:'Módulo opcional'},
  {type:'end',icon:'⛔',name:'Finalizar',description:'Cerrar flujo'},
];

export function FlowBuilderChrome({ flowName, dirty, palette=DEFAULT_PALETTE, canvas, inspector, onFlowNameChange, onAddNode, onUndo, onRedo, onSearch, onValidate, onSimulate, onSave, onPublish, onVersions }: {
  flowName:string; dirty?:boolean; palette?:PaletteItem[]; canvas:React.ReactNode; inspector:React.ReactNode;
  onFlowNameChange?:(v:string)=>void; onAddNode?:(type:string)=>void; onUndo?:()=>void; onRedo?:()=>void; onSearch?:(q:string)=>void; onValidate?:()=>void; onSimulate?:()=>void; onSave?:()=>void; onPublish?:()=>void; onVersions?:()=>void;
}) {
  return <div className={styles.shell}>
    <aside className={styles.left}><div className={styles.flowName}><label>Nombre del bot</label><input value={flowName} onChange={(e)=>onFlowNameChange?.(e.target.value)}/>{dirty&&<small>● Cambios sin guardar</small>}</div><div className={styles.panelTitle}>Bloques</div><p className={styles.hint}>Añade bloques al canvas del constructor existente.</p><div className={styles.palette}>{palette.map((p)=><button key={p.type} onClick={()=>onAddNode?.(p.type)}><span>{p.icon}</span><div><strong>{p.name}</strong><small>{p.description}</small></div></button>)}</div><div className={styles.bottom}><button onClick={onVersions}>🗂️ Versiones</button><button onClick={onValidate}>✓ Revisar flujo</button></div></aside>
    <section className={styles.center}><div className={styles.toolbar}><div><button onClick={onUndo}>↶</button><button onClick={onRedo}>↷</button></div><input placeholder="Buscar bloque..." onKeyDown={(e)=>{if(e.key==='Enter')onSearch?.((e.target as HTMLInputElement).value)}}/><div><button onClick={onSimulate}>🧪 Probar</button><button onClick={onSave}>Guardar</button><button className={styles.publish} onClick={onPublish}>🚀 Publicar</button></div></div><div className={styles.canvasSlot}>{canvas}</div></section>
    <aside className={styles.right}><div className={styles.panelTitle}>Propiedades</div><p className={styles.hint}>Configura aquí el nodo seleccionado.</p>{inspector}</aside>
  </div>;
}
