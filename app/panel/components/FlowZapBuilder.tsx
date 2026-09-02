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

// --- CUSTOM NODES (From FlowEditor) ---
const nodeStyle = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '12px',
  minWidth: '200px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

const headerStyle = {
  fontWeight: 'bold',
  fontSize: '12px',
  marginBottom: '8px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px'
};

const StartNode = ({ data }: any) => (
  <div style={{ ...nodeStyle, borderTop: '4px solid #10b981' }}>
    <div style={headerStyle}><span className="material-symbols-outlined text-sm">play_circle</span>Inicio</div>
    <div style={{ fontSize: '10px', color: '#64748b' }}>Comienzo de la conversación</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const MessageNode = ({ data }: any) => (
  <div style={{ ...nodeStyle, borderTop: '4px solid #3b82f6' }}>
    <Handle type="target" position={Position.Top} />
    <div style={headerStyle}><span className="material-symbols-outlined text-sm">chat</span>Mensaje</div>
    <div style={{ fontSize: '11px', padding: '4px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
      {data.text || 'Sin texto...'}
    </div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const ButtonsNode = ({ data }: any) => {
  const buttons = data.buttons || [];
  return (
    <div style={{ ...nodeStyle, borderTop: '4px solid #f59e0b' }}>
      <Handle type="target" position={Position.Top} />
      <div style={headerStyle}><span className="material-symbols-outlined text-sm">smart_button</span>Botones</div>
      <div style={{ fontSize: '11px', padding: '4px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #f1f5f9', marginBottom: '8px' }}>
        {data.text || 'Elige:'}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {buttons.map((btn: any, idx: number) => (
          <div key={idx} style={{ position: 'relative', background: '#e0e7ff', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', textAlign: 'center', fontWeight: 'bold', color: '#3730a3' }}>
            {btn.label}
            <Handle type="source" position={Position.Right} id={btn.label.toLowerCase()} style={{ top: '50%', right: '-12px' }} />
          </div>
        ))}
      </div>
    </div>
  );
};

const QuestionNode = ({ data }: any) => (
  <div style={{ ...nodeStyle, borderTop: '4px solid #8b5cf6' }}>
    <Handle type="target" position={Position.Top} />
    <div style={headerStyle}><span className="material-symbols-outlined text-sm">help</span>Pregunta</div>
    <div style={{ fontSize: '11px', padding: '4px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #f1f5f9' }}>
      {data.text || 'Pregunta...'}
    </div>
    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>Variable: {data.variable || 'ninguna'}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const ConditionNode = ({ data }: any) => (
  <div style={{ ...nodeStyle, borderTop: '4px solid #06b6d4' }}>
    <Handle type="target" position={Position.Top} />
    <div style={headerStyle}><span className="material-symbols-outlined text-sm">alt_route</span>Condición</div>
    <div style={{ position: 'relative', background: '#dcfce7', padding: '4px', borderRadius: '4px', fontSize: '10px', textAlign: 'center', marginBottom: '4px', color: '#166534' }}>
      Verdadero
      <Handle type="source" position={Position.Right} id="true" style={{ top: '50%', right: '-12px', background: '#22c55e' }} />
    </div>
    <div style={{ position: 'relative', background: '#fee2e2', padding: '4px', borderRadius: '4px', fontSize: '10px', textAlign: 'center', color: '#991b1b' }}>
      Falso
      <Handle type="source" position={Position.Right} id="false" style={{ top: '50%', right: '-12px', background: '#ef4444' }} />
    </div>
  </div>
);

const MediaNode = ({ data }: any) => (
  <div style={{ ...nodeStyle, borderTop: '4px solid #ec4899' }}>
    <Handle type="target" position={Position.Top} />
    <div style={headerStyle}><span className="material-symbols-outlined text-sm">perm_media</span>Multimedia</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const AiNode = ({ data }: any) => (
  <div style={{ ...nodeStyle, borderTop: '4px solid #7c3aed' }}>
    <Handle type="target" position={Position.Top} />
    <div style={headerStyle}><span className="material-symbols-outlined text-sm">psychology</span>IA Premium</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const nodeTypes: NodeTypes = {
  start: StartNode,
  message: MessageNode,
  buttons: ButtonsNode,
  question: QuestionNode,
  condition: ConditionNode,
  media: MediaNode,
  ai: AiNode,
};

// --- MAIN COMPONENT ---
export default function FlowZapBuilder() {
  const defaultStartNode = { id: 'start_1', type: 'start', position: { x: 250, y: 50 }, data: {} };
  
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

  const onNodeClick = (e: any, node: any) => setSelectedNode(node);

  const addNode = (type: string) => {
    const newNode = {
      id: `${type}_${Date.now()}`,
      type,
      position: { x: 300, y: 200 },
      data: type === 'buttons' ? { text: 'Elige:', buttons: [{ label: 'Opción 1' }] } 
          : type === 'condition' ? { variable: 'nombre', operator: '==', value: 'Juan' }
          : type === 'question' ? { text: '¿Cual es tu nombre?', variable: 'nombre' }
          : type === 'media' ? { mediaType: 'image', url: '', text: '' }
          : { text: 'Nuevo mensaje' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateSelectedNodeData = (field: string, value: any) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          const updatedNode = { ...n, data: { ...n.data, [field]: value } };
          setSelectedNode(updatedNode); // update local state so inspector reflects change
          return updatedNode;
        }
        return n;
      })
    );
  };

  return (
    <div className="h-[calc(100vh-140px)] grid grid-cols-[220px_minmax(500px,1fr)_320px] bg-white font-inter text-slate-800 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      
      {/* Barra Izquierda: Herramientas */}
      <div className="border-r border-slate-200 bg-white min-h-0 overflow-auto p-3.5 flex flex-col z-10 shadow-sm relative">
        <div className="mb-4">
          <label className="block text-[9px] text-slate-500 uppercase font-black mb-1.5 tracking-wider">Nombre del flujo</label>
          <input 
            type="text" 
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="w-full border border-slate-200 rounded-lg p-2 text-[11px] outline-none focus:border-green-500 transition-colors bg-white font-bold"
          />
        </div>
        
        <strong className="block text-[11px] font-black text-slate-800 mb-2 mt-2">Bloques</strong>
        <div className="grid gap-1.5">
          <button onClick={() => addNode('message')} className="flex items-center gap-2.5 p-2.5 border border-slate-200 bg-white rounded-lg text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="w-7 h-7 grid place-items-center rounded-lg bg-blue-100 text-blue-600 text-[14px]">💬</div>
            <div>
              <strong className="block text-[10px] text-slate-800 font-bold">Mensaje</strong>
              <small className="block text-slate-500 text-[8px] mt-0.5">Texto, link, etc.</small>
            </div>
          </button>
          
          <button onClick={() => addNode('buttons')} className="flex items-center gap-2.5 p-2.5 border border-slate-200 bg-white rounded-lg text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="w-7 h-7 grid place-items-center rounded-lg bg-violet-100 text-violet-600 text-[14px]">☰</div>
            <div>
              <strong className="block text-[10px] text-slate-800 font-bold">Botones / Menú</strong>
              <small className="block text-slate-500 text-[8px] mt-0.5">Opciones rápidas</small>
            </div>
          </button>

          <button onClick={() => addNode('question')} className="flex items-center gap-2.5 p-2.5 border border-slate-200 bg-white rounded-lg text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="w-7 h-7 grid place-items-center rounded-lg bg-amber-100 text-amber-600 text-[14px]">❓</div>
            <div>
              <strong className="block text-[10px] text-slate-800 font-bold">Pregunta libre</strong>
              <small className="block text-slate-500 text-[8px] mt-0.5">Guardar respuesta</small>
            </div>
          </button>

          <button onClick={() => addNode('condition')} className="flex items-center gap-2.5 p-2.5 border border-slate-200 bg-white rounded-lg text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="w-7 h-7 grid place-items-center rounded-lg bg-red-100 text-red-600 text-[14px]">🔀</div>
            <div>
              <strong className="block text-[10px] text-slate-800 font-bold">Condición</strong>
              <small className="block text-slate-500 text-[8px] mt-0.5">Lógica SI / NO</small>
            </div>
          </button>

          <button onClick={() => addNode('media')} className="flex items-center gap-2.5 p-2.5 border border-slate-200 bg-white rounded-lg text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="w-7 h-7 grid place-items-center rounded-lg bg-pink-100 text-pink-600 text-[14px]">🖼️</div>
            <div>
              <strong className="block text-[10px] text-slate-800 font-bold">Multimedia</strong>
              <small className="block text-slate-500 text-[8px] mt-0.5">Enviar archivos</small>
            </div>
          </button>

          <button onClick={() => addNode('ai')} className="flex items-center gap-2.5 p-2.5 border border-slate-200 bg-white rounded-lg text-left hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="w-7 h-7 grid place-items-center rounded-lg bg-purple-100 text-purple-600 text-[14px]">🧠</div>
            <div>
              <strong className="block text-[10px] text-slate-800 font-bold">IA Premium</strong>
              <small className="block text-slate-500 text-[8px] mt-0.5">Asistente avanzado</small>
            </div>
          </button>
        </div>

        <div className="mt-auto pt-3.5 grid gap-1.5">
          <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg text-[11px] transition-colors shadow-sm">
            Guardar flujo
          </button>
        </div>
      </div>

      {/* Canvas Central */}
      <div className="flex flex-col min-w-0 bg-[#f6f8fb] relative">
        <div className="h-10 flex items-center justify-between px-3 border-b border-slate-200 bg-white/80 text-[9px] text-slate-500 backdrop-blur-sm z-20">
          <div className="flex gap-1.5">
            <input 
              type="text" 
              placeholder="Buscar bloque..." 
              className="w-[220px] border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] outline-none bg-white"
            />
          </div>
        </div>
        
        <div className="flex-1 w-full h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedNode(null)}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#ccc" gap={22} size={1} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>

      {/* Barra Derecha: Inspector */}
      <div className="border-l border-slate-200 bg-white min-h-0 overflow-auto p-4 flex flex-col z-10 shadow-sm relative">
        <h3 className="m-0 mb-1 text-[13px] font-bold text-slate-800">Propiedades</h3>
        
        {!selectedNode ? (
          <div className="text-xs text-slate-400 mt-10 text-center">Selecciona un bloque en el lienzo para configurarlo.</div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Bloque: {selectedNode.type}</div>
            
            {['message', 'buttons', 'question', 'media', 'ai'].includes(selectedNode.type) && (
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1">Texto del mensaje / Prompt</label>
                <textarea 
                  value={selectedNode.data.text || ''} 
                  onChange={(e) => updateSelectedNodeData('text', e.target.value)}
                  className="w-full text-[11px] border border-slate-200 rounded-lg p-2 min-h-[80px] focus:border-green-500 outline-none transition-colors bg-slate-50 focus:bg-white"
                  placeholder="Escribe aquí..."
                />
              </div>
            )}

            {selectedNode.type === 'buttons' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-2">Botones (Opciones)</label>
                {(selectedNode.data.buttons || []).map((btn: any, idx: number) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      value={btn.label}
                      onChange={(e) => {
                        const newButtons = [...selectedNode.data.buttons];
                        newButtons[idx].label = e.target.value;
                        updateSelectedNodeData('buttons', newButtons);
                      }}
                      className="flex-1 text-[11px] border border-slate-200 rounded-lg p-1.5 focus:border-green-500 outline-none transition-colors"
                    />
                    <button 
                      onClick={() => {
                        const newButtons = selectedNode.data.buttons.filter((_: any, i: number) => i !== idx);
                        updateSelectedNodeData('buttons', newButtons);
                      }}
                      className="px-2 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {(selectedNode.data.buttons || []).length < 3 && (
                  <button 
                    onClick={() => {
                      const newButtons = [...(selectedNode.data.buttons || []), { label: `Opción ${(selectedNode.data.buttons || []).length + 1}` }];
                      updateSelectedNodeData('buttons', newButtons);
                    }}
                    className="w-full py-1.5 border border-dashed border-slate-300 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 mt-2 transition-colors"
                  >
                    + Agregar Botón
                  </button>
                )}
              </div>
            )}

            <button 
              onClick={() => {
                setNodes(nodes.filter(n => n.id !== selectedNode.id));
                setSelectedNode(null);
              }} 
              className="w-full mt-6 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-bold hover:bg-red-100 transition-colors"
            >
              Eliminar Nodo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
