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
  Panel,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// --- CUSTOM NODES ---

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
    <div style={headerStyle}>
      <span className="material-symbols-outlined text-sm">play_circle</span>
      Inicio
    </div>
    <div style={{ fontSize: '10px', color: '#64748b' }}>Comienzo de la conversación</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const MessageNode = ({ data }: any) => (
  <div style={{ ...nodeStyle, borderTop: '4px solid #3b82f6' }}>
    <Handle type="target" position={Position.Top} />
    <div style={headerStyle}>
      <span className="material-symbols-outlined text-sm">chat</span>
      Enviar Mensaje
    </div>
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
      <div style={headerStyle}>
        <span className="material-symbols-outlined text-sm">smart_button</span>
        Opciones (Botones)
      </div>
      <div style={{ fontSize: '11px', padding: '4px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #f1f5f9', marginBottom: '8px' }}>
        {data.text || 'Elige una opción:'}
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
    <div style={headerStyle}>
      <span className="material-symbols-outlined text-sm">help</span>
      Pregunta (Guardar)
    </div>
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
    <div style={headerStyle}>
      <span className="material-symbols-outlined text-sm">alt_route</span>
      Condición
    </div>
    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px' }}>
      Si {data.variable || 'var'} {data.operator || '=='} {data.value || 'val'}
    </div>
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
    <div style={headerStyle}>
      <span className="material-symbols-outlined text-sm">perm_media</span>
      Multimedia
    </div>
    <div style={{ fontSize: '10px', color: '#64748b' }}>Tipo: {data.mediaType || 'image'}</div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const HumanNode = ({ data }: any) => (
  <div style={{ ...nodeStyle, borderTop: '4px solid #ef4444' }}>
    <Handle type="target" position={Position.Top} />
    <div style={headerStyle}>
      <span className="material-symbols-outlined text-sm">support_agent</span>
      Pasar a Humano
    </div>
    <div style={{ fontSize: '10px', color: '#64748b' }}>Pausa el bot y avisa al equipo</div>
  </div>
);

const nodeTypes: NodeTypes = {
  start: StartNode,
  message: MessageNode,
  buttons: ButtonsNode,
  question: QuestionNode,
  condition: ConditionNode,
  media: MediaNode,
  human: HumanNode,
};

// --- MAIN COMPONENT ---

export default function FlowEditor({ initialData, onSave }: { initialData: any, onSave: (data: any) => void }) {
  const defaultStartNode = { id: 'start_1', type: 'start', position: { x: 250, y: 50 }, data: {} };
  
  let loadedNodes = [defaultStartNode];
  let loadedEdges: Edge[] = [];
  
  if (initialData && typeof initialData === 'object') {
      if (Array.isArray(initialData.nodes) && initialData.nodes.length > 0) {
          loadedNodes = initialData.nodes;
      }
      if (Array.isArray(initialData.edges)) {
          loadedEdges = initialData.edges;
      }
  }

  const [nodes, setNodes, onNodesChange] = useNodesState(loadedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(loadedEdges);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ 
      ...params, 
      type: 'smoothstep', 
      markerEnd: { type: MarkerType.ArrowClosed } 
    }, eds)),
    [setEdges]
  );

  const onNodeClick = (e: any, node: any) => {
    setSelectedNode(node);
  };

  const handleSave = () => {
    onSave({ nodes, edges });
  };

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

  const updateSelectedNodeData = (key: string, value: any) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          const updatedNode = { ...n, data: { ...n.data, [key]: value } };
          setSelectedNode(updatedNode); 
          return updatedNode;
        }
        return n;
      })
    );
  };

  return (
    <div className="flex h-full w-full border border-slate-200 overflow-hidden bg-slate-50">
      {/* Editor Workspace */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedNode(null)}
          fitView
        >
          <Background color="#ccc" gap={16} />
          <Controls />
          <MiniMap />
          <Panel position="top-left" className="flex flex-wrap gap-2 max-w-2xl bg-white/80 p-2 rounded-xl backdrop-blur shadow-sm border border-slate-200">
            <button onClick={() => addNode('message')} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">chat</span> Mensaje</button>
            <button onClick={() => addNode('buttons')} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">smart_button</span> Botones</button>
            <button onClick={() => addNode('question')} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">help</span> Pregunta</button>
            <button onClick={() => addNode('condition')} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">alt_route</span> Condición</button>
            <button onClick={() => addNode('media')} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">perm_media</span> Media</button>
            <button onClick={() => addNode('human')} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1 text-red-600"><span className="material-symbols-outlined text-[14px]">support_agent</span> Humano</button>
          </Panel>
          <Panel position="top-right">
            <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700">
              Guardar Flujo
            </button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Sidebar de Configuración */}
      <div className="w-80 bg-white border-l border-slate-200 p-4 overflow-y-auto z-10 shadow-xl">
        <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Propiedades del Bloque</h3>
        
        {!selectedNode ? (
          <div className="text-xs text-slate-400 text-center mt-10">Selecciona un bloque para editarlo</div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{selectedNode.type}</div>
            
            {['message', 'buttons', 'question', 'media'].includes(selectedNode.type) && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Texto del mensaje</label>
                <textarea 
                  value={selectedNode.data.text || ''} 
                  onChange={(e) => updateSelectedNodeData('text', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 min-h-[80px] focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ej: Hola {{nombre}}..."
                />
              </div>
            )}

            {selectedNode.type === 'buttons' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Botones (Opciones)</label>
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
                      className="flex-1 text-sm border border-slate-200 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button 
                      onClick={() => {
                        const newButtons = selectedNode.data.buttons.filter((_: any, i: number) => i !== idx);
                        updateSelectedNodeData('buttons', newButtons);
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
                {(selectedNode.data.buttons || []).length < 3 && (
                  <button 
                    onClick={() => {
                      const newButtons = [...(selectedNode.data.buttons || []), { label: `Opción ${(selectedNode.data.buttons || []).length + 1}` }];
                      updateSelectedNodeData('buttons', newButtons);
                    }}
                    className="w-full py-1.5 border border-dashed border-indigo-300 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 mt-2"
                  >
                    + Agregar Botón
                  </button>
                )}
              </div>
            )}

            {selectedNode.type === 'question' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Guardar en Variable</label>
                <input 
                  type="text" 
                  value={selectedNode.data.variable || ''} 
                  onChange={(e) => updateSelectedNodeData('variable', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="ej: nombre, email..."
                />
              </div>
            )}

            {selectedNode.type === 'condition' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Variable a evaluar</label>
                  <input type="text" value={selectedNode.data.variable || ''} onChange={(e) => updateSelectedNodeData('variable', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 outline-none" placeholder="nombre" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Operador</label>
                  <select value={selectedNode.data.operator || '=='} onChange={(e) => updateSelectedNodeData('operator', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 outline-none">
                    <option value="==">Es igual a (==)</option>
                    <option value="!=">Diferente a (!=)</option>
                    <option value="contains">Contiene</option>
                    <option value="&gt;">Mayor que (&gt;)</option>
                    <option value="&lt;">Menor que (&lt;)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Valor</label>
                  <input type="text" value={selectedNode.data.value || ''} onChange={(e) => updateSelectedNodeData('value', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 outline-none" placeholder="Valor a comparar" />
                </div>
              </div>
            )}

            {selectedNode.type === 'media' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Archivo</label>
                  <select value={selectedNode.data.mediaType || 'image'} onChange={(e) => updateSelectedNodeData('mediaType', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 outline-none">
                    <option value="image">Imagen</option>
                    <option value="video">Video</option>
                    <option value="document">Documento (PDF)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">URL Pública del Archivo</label>
                  <input type="url" value={selectedNode.data.url || ''} onChange={(e) => updateSelectedNodeData('url', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 outline-none" placeholder="https://..." />
                </div>
              </div>
            )}
            
            <button onClick={() => setNodes(nodes.filter(n => n.id !== selectedNode.id))} className="w-full mt-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 flex justify-center items-center gap-1">
              <span className="material-symbols-outlined text-sm">delete</span> Eliminar Nodo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
