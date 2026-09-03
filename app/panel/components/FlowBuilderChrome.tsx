'use client';
import React from 'react';
import styles from './builder.module.css';

export type PaletteItem = { type:string; icon:string; name:string; description:string; tooltip:string };

export const DEFAULT_PALETTE: PaletteItem[] = [
  {type:'start',icon:'▶️',name:'Inicio',description:'Punto inicial',tooltip:'El flujo siempre comienza aquí. No se puede eliminar.'},
  {type:'message',icon:'💬',name:'Mensaje',description:'Enviar texto',tooltip:'Muestra un simple mensaje de texto al usuario.'},
  {type:'menu',icon:'📋',name:'Menú',description:'Opciones numeradas',tooltip:'Crea un menú interactivo con varias opciones. Cada opción se convierte en un camino diferente.'},
  {type:'buttons',icon:'🔘',name:'Botones',description:'Acciones rápidas',tooltip:'Muestra botones seleccionables en pantalla.'},
  {type:'question',icon:'✍️',name:'Pregunta',description:'Guardar respuesta',tooltip:'Pide un dato al usuario y lo guarda en una variable (ej. nombre, email).'},
  {type:'condition',icon:'🔀',name:'Condición',description:'IF / ELSE',tooltip:'Toma una decisión basada en el valor de una variable guardada (ej. si el nombre es vacío, ir por un camino).'},
  {type:'media',icon:'🖼️',name:'Multimedia',description:'Imagen, video o PDF',tooltip:'Envía un archivo multimedia adjunto al chat.'},
  {type:'tag',icon:'🏷️',name:'Etiqueta',description:'Agregar o quitar tags',tooltip:'Asigna una etiqueta interna al cliente para segmentarlo (ej. cliente-vip).'},
  {type:'wait',icon:'⏳',name:'Espera',description:'Pausa programada',tooltip:'Detiene el bot por un tiempo determinado antes de seguir al siguiente paso.'},
  {type:'human',icon:'👤',name:'Humano',description:'Pasar a asesor',tooltip:'Detiene el bot permanentemente y asigna el chat a un asesor humano.'},
  {type:'ai',icon:'🧠',name:'IA Premium',description:'Módulo opcional',tooltip:'Usa inteligencia artificial conectada a tu base de datos para responder de forma abierta.'},
  {type:'end',icon:'⛔',name:'Finalizar',description:'Cerrar flujo',tooltip:'Marca el final de la conversación o de esta rama del flujo.'},
];

export function FlowBuilderChrome({ flowName, dirty, palette=DEFAULT_PALETTE, canvas, inspector, onFlowNameChange, onAddNode, onUndo, onRedo, onSearch, onValidate, onSimulate, onSave, onPublish, onVersions }: {
  flowName:string; dirty?:boolean; palette?:PaletteItem[]; canvas:React.ReactNode; inspector:React.ReactNode;
  onFlowNameChange?:(v:string)=>void; onAddNode?:(type:string)=>void; onUndo?:()=>void; onRedo?:()=>void; onSearch?:(q:string)=>void; onValidate?:()=>void; onSimulate?:()=>void; onSave?:()=>void; onPublish?:()=>void; onVersions?:()=>void;
}) {
  const [hoveredTooltip, setHoveredTooltip] = React.useState<string | null>(null);

  return <div className={styles.shell}>
    <aside className={styles.left}>
      <div className={styles.flowName}>
        <label>Nombre del bot</label>
        <input value={flowName} onChange={(e)=>onFlowNameChange?.(e.target.value)}/>
        {dirty&&<small>● Cambios sin guardar</small>}
      </div>
      <div className={styles.panelTitle}>Bloques</div>
      <p className={styles.hint}>Añade bloques al canvas del constructor existente.</p>
      
      <div className={styles.palette}>
        {palette.map((p) => (
          <button 
            key={p.type} 
            onClick={() => onAddNode?.(p.type)} 
            className="relative flex items-center gap-2"
          >
            <span>{p.icon}</span>
            <div style={{flex:1, textAlign:'left'}}>
              <strong>{p.name}</strong>
              <small>{p.description}</small>
            </div>
            
            {/* Elegant Popover Tooltip Model */}
            <div className="relative group/help ml-auto">
              <span className="material-symbols-outlined text-[14px] text-slate-300 hover:text-blue-500 cursor-help p-1 transition-colors">help</span>
              
              <div className="absolute top-1/2 -translate-y-1/2 left-full ml-3 w-64 bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-2xl border border-slate-100 p-4 opacity-0 group-hover/help:opacity-100 transition-all pointer-events-none z-[100] scale-95 group-hover/help:scale-100 origin-left text-left">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full border-2 border-[#1e1b4b] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#1e1b4b] text-[12px] font-bold">info</span>
                  </div>
                  <p className="text-xs font-bold text-[#1e1b4b] m-0 leading-none">{p.name}</p>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed m-0 normal-case font-normal">
                  {p.tooltip}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className={styles.bottom}>
        <button onClick={onVersions}>🗂️ Plantillas</button>
        <button onClick={onValidate}>✓ Revisar flujo</button>
      </div>
    </aside>
    <section className={styles.center}><div className={styles.toolbar}><div><button onClick={onUndo}>↶</button><button onClick={onRedo}>↷</button></div><input placeholder="Buscar bloque..." onKeyDown={(e)=>{if(e.key==='Enter')onSearch?.((e.target as HTMLInputElement).value)}}/><div><button onClick={onSimulate}>🧪 Probar</button><button onClick={onSave}>Guardar</button><button className={styles.publish} onClick={onPublish}>🚀 Publicar</button></div></div><div className={styles.canvasSlot}>{canvas}</div></section>
    <aside className={styles.right}><div className={styles.panelTitle}>Propiedades</div><p className={styles.hint}>Configura aquí el nodo seleccionado.</p>{inspector}</aside>
  </div>;
}
