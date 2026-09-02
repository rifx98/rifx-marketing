'use client';

import React, { useState, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  NodeTypes,
  Handle,
  Position,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { FlowBuilderChrome } from './FlowBuilderChrome';
import { InspectorField, InspectorDivider, InspectorToggle } from './BuilderInspectorPrimitives';

// --- CUSTOM NODES (PREMIUM DESIGN) ---

const NodeHeader = ({ icon, title, typeLabel, color }: { icon: string, title: string, typeLabel: string, color: string }) => (
  <div className="flex items-center gap-2 mb-2">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[16px] text-white`} style={{ backgroundColor: color }}>
      {icon}
    </div>
    <div>
      <h4 className="m-0 text-[13px] font-extrabold text-slate-800 leading-tight">{title}</h4>
      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">{typeLabel}</span>
    </div>
  </div>
);

const premiumNodeStyle = "bg-white border border-slate-200 rounded-xl p-3 shadow-[0_4px_12px_rgba(0,0,0,0.04)] min-w-[240px] font-sans relative hover:border-slate-300 hover:shadow-md transition-all";
const handleStyle = { width: 10, height: 10, backgroundColor: '#cbd5e1', border: '2px solid white' };

const StartNode = ({ data }: any) => (
  <div className={`${premiumNodeStyle} border-l-4 border-l-emerald-500`}>
    <NodeHeader icon="▶" title="Inicio" typeLabel="PUNTO DE ENTRADA" color="#10b981" />
    <p className="text-slate-500 text-[11px] leading-relaxed">El bot comienza aquí cuando un usuario escribe.</p>
    <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -6 }} />
  </div>
);

const MessageNode = ({ data }: any) => (
  <div className={`${premiumNodeStyle} border-l-4 border-l-blue-500`}>
    <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -6 }} />
    <NodeHeader icon="💬" title={data.name || "Mensaje"} typeLabel="MENSAJE" color="#3b82f6" />
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 mt-2">
      <p className="text-slate-600 text-[11px] whitespace-pre-wrap">{data.text || 'Hola! ¿En qué te puedo ayudar hoy?'}</p>
    </div>
    <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -6 }} />
  </div>
);

const ButtonsNode = ({ data }: any) => {
  const buttons = data.buttons || [];
  return (
    <div className={`${premiumNodeStyle} border-l-4 border-l-violet-500`}>
      <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -6 }} />
      <NodeHeader icon="📋" title={data.name || "Menú principal"} typeLabel="MENÚ" color="#8b5cf6" />
      <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 mt-2 mb-2">
        <p className="text-slate-600 text-[11px] whitespace-pre-wrap">{data.text || 'Escribe una opción:'}</p>
      </div>
      <div className="flex flex-col gap-1.5 mt-2">
        {buttons.map((btn: any, idx: number) => (
          <div key={idx} className="relative bg-white border border-slate-200 p-1.5 rounded-md text-[10px] font-bold text-slate-700 flex items-center justify-between shadow-sm">
            <span>{idx + 1}. {btn.label}</span>
            <Handle type="source" position={Position.Right} id={btn.label} style={{ ...handleStyle, right: -10, top: '50%' }} />
          </div>
        ))}
      </div>
    </div>
  );
};

const QuestionNode = ({ data }: any) => (
  <div className={`${premiumNodeStyle} border-l-4 border-l-amber-500`}>
    <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -6 }} />
    <NodeHeader icon="✍️" title={data.name || "Pregunta"} typeLabel="PREGUNTA" color="#f59e0b" />
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 mt-2">
      <p className="text-slate-600 text-[11px] whitespace-pre-wrap">{data.text || 'Pregunta...'}</p>
    </div>
    <p className="text-[9px] text-slate-400 mt-2">Guarda respuesta en: <strong className="text-slate-600">{data.variable || '{var}'}</strong></p>
    <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -6 }} />
  </div>
);

const HumanNode = ({ data }: any) => (
  <div className={`${premiumNodeStyle} border-l-4 border-l-red-500`}>
    <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -6 }} />
    <NodeHeader icon="👤" title={data.name || "Pasar a asesor"} typeLabel="ASESOR" color="#ef4444" />
    <p className="text-slate-500 text-[11px]">Perfecto 👩‍💼 Pasaré el bot para que un asesor continúe la conversación.</p>
  </div>
);

const nodeTypes: NodeTypes = {
  start: StartNode,
  message: MessageNode,
  menu: ButtonsNode,
  question: QuestionNode,
  human: HumanNode,
};

// --- MAIN COMPONENT ---
export default function FlowZapBuilder() {
  const defaultStartNode = { id: 'start_1', type: 'start', position: { x: 250, y: 150 }, data: {} };
  
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([defaultStartNode]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [flowName, setFlowName] = useState('Mi chatbot');

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ 
      ...params, 
      type: 'smoothstep', 
      markerEnd: { type: MarkerType.ArrowClosed } 
    }, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const newNode = {
      id: `${type}_${Date.now()}`,
      type,
      position: { x: Math.random() * 200 + 400, y: Math.random() * 200 + 100 },
      data: type === 'menu' ? { name: 'Opciones', text: 'Elige:', buttons: [{ label: 'Opción 1' }] } 
          : type === 'question' ? { name: 'Pregunta', text: '¿Cual es tu nombre?', variable: 'nombre' }
          : { name: 'Mensaje', text: 'Nuevo mensaje' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateSelectedNodeData = (field: string, value: any) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode?.id) {
          const updated = { ...n, data: { ...n.data, [field]: value } };
          setSelectedNode(updated);
          return updated;
        }
        return n;
      })
    );
  };

  const deleteNode = () => {
    if(!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setSelectedNode(null);
  };

  // --- RENDERING EL CANVAS ---
  const canvas = (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={(e, node) => setSelectedNode(node)}
      onPaneClick={() => setSelectedNode(null)}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
    >
      <Background color="#cbd5e1" gap={24} size={2} />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );

  // --- RENDERING EL INSPECTOR ---
  const inspector = !selectedNode ? (
    <div style={{textAlign:'center', marginTop:40, color:'#94a3b8', fontSize:12}}>
      Selecciona un bloque para editar sus acciones y conexiones.
    </div>
  ) : (
    <div>
      <InspectorField label="Bloque">
        <input type="text" value={selectedNode.type.toUpperCase()} readOnly disabled style={{background:'#f8fafc', color:'#94a3b8'}} />
      </InspectorField>
      
      <InspectorField label="Título del bloque">
        <input type="text" value={selectedNode.data.name || ''} onChange={(e) => updateSelectedNodeData('name', e.target.value)} />
      </InspectorField>

      {['message', 'menu', 'question'].includes(selectedNode.type) && (
        <InspectorField label="Contenido del mensaje" help="Texto que enviará el bot">
          <textarea 
            value={selectedNode.data.text || ''} 
            onChange={(e) => updateSelectedNodeData('text', e.target.value)}
          />
        </InspectorField>
      )}

      {selectedNode.type === 'menu' && (
        <div style={{marginTop: 15}}>
          <label style={{fontSize: 9, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', display: 'block', marginBottom: 5}}>Opciones del menú</label>
          {(selectedNode.data.buttons || []).map((btn: any, idx: number) => (
            <div key={idx} style={{display:'flex', gap:5, marginBottom: 5}}>
              <input 
                type="text" 
                value={btn.label}
                onChange={(e) => {
                  const newButtons = [...selectedNode.data.buttons];
                  newButtons[idx].label = e.target.value;
                  updateSelectedNodeData('buttons', newButtons);
                }}
                style={{flex:1, border:'1px solid #e5e7eb', borderRadius:8, padding:'6px 9px', fontSize:10}}
              />
              <button 
                onClick={() => {
                  const newButtons = selectedNode.data.buttons.filter((_: any, i: number) => i !== idx);
                  updateSelectedNodeData('buttons', newButtons);
                }}
                style={{background:'#fee2e2', color:'#ef4444', border:'none', borderRadius:8, padding:'0 10px', cursor:'pointer'}}
              >✕</button>
            </div>
          ))}
          <button 
            onClick={() => {
              const newButtons = [...(selectedNode.data.buttons || []), { label: `Opción ${(selectedNode.data.buttons || []).length + 1}` }];
              updateSelectedNodeData('buttons', newButtons);
            }}
            style={{width:'100%', padding:'6px', background:'#f8fafc', border:'1px dashed #cbd5e1', borderRadius:8, fontSize:10, color:'#64748b', cursor:'pointer', marginTop:4}}
          >+ Agregar Opción</button>
        </div>
      )}

      {selectedNode.type === 'question' && (
        <InspectorField label="Guardar respuesta en variable">
          <input type="text" value={selectedNode.data.variable || ''} onChange={(e) => updateSelectedNodeData('variable', e.target.value)} placeholder="Ej: email, nombre..." />
        </InspectorField>
      )}

      <InspectorDivider />

      <button onClick={deleteNode} style={{width:'100%', padding:'10px', background:'#fee2e2', color:'#ef4444', border:'none', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize:11}}>
        Eliminar Bloque
      </button>
    </div>
  );

  return (
    <FlowBuilderChrome
      flowName={flowName}
      onFlowNameChange={setFlowName}
      dirty={false}
      canvas={canvas}
      inspector={inspector}
      onAddNode={addNode}
      onSave={() => alert('Guardando flujo...')}
      onPublish={() => alert('Publicando...')}
      onValidate={() => alert('Flujo validado correctamente.')}
    />
  );
}
