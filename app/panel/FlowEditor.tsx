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
            <Handle 
              type="source" 
              position={Position.Right} 
              id={btn.label.toLowerCase()} 
              style={{ top: '50%', right: '-12px' }} 
            />
          </div>
        ))}
      </div>
    </div>
  );
};

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
      data: type === 'buttons' ? { text: 'Elige:', buttons: [{ label: 'Opción 1' }] } : { text: 'Nuevo mensaje' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateSelectedNodeData = (key: string, value: any) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          const updatedNode = { ...n, data: { ...n.data, [key]: value } };
          setSelectedNode(updatedNode); // update local state so sidebar reflects changes
          return updatedNode;
        }
        return n;
      })
    );
  };

  return (
    <div className="flex h-[700px] border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
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
          <Panel position="top-left" className="flex gap-2">
            <button onClick={() => addNode('message')} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">chat</span> Mensaje
            </button>
            <button onClick={() => addNode('buttons')} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">smart_button</span> Botones
            </button>
            <button onClick={() => addNode('human')} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">support_agent</span> Humano
            </button>
          </Panel>
          <Panel position="top-right">
            <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700">
              Guardar Flujo
            </button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Sidebar de Configuración */}
      <div className="w-80 bg-white border-l border-slate-200 p-4 overflow-y-auto">
        <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Propiedades del Bloque</h3>
        
        {!selectedNode ? (
          <div className="text-xs text-slate-400 text-center mt-10">Selecciona un bloque para editarlo</div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{selectedNode.type}</div>
            
            {['message', 'buttons', 'human'].includes(selectedNode.type) && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Texto del mensaje</label>
                <textarea 
                  value={selectedNode.data.text || ''} 
                  onChange={(e) => updateSelectedNodeData('text', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 min-h-[100px] focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Escribe el mensaje..."
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
                <p className="text-[10px] text-slate-400 mt-2">WhatsApp permite máximo 3 botones por mensaje.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
