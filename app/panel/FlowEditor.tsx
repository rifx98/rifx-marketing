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
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// --- CUSTOM EDGES ---
const RemovableEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, markerEnd }: any) => {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="react-flow__edge-interaction group"
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <div className="relative group/trash flex items-center justify-center">
            <button
              className="w-6 h-6 bg-white text-rose-500 rounded-full flex items-center justify-center shadow-md border border-slate-200 hover:scale-110 hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer opacity-70 group-hover/trash:opacity-100 z-50 text-[12px]"
              onClick={(event) => {
                event.stopPropagation();
                setEdges((eds) => eds.filter((e) => e.id !== id));
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
            </button>
            
            {/* Simple Hover Tooltip */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap opacity-0 invisible scale-95 group-hover/trash:opacity-100 group-hover/trash:visible group-hover/trash:scale-100 transition-all duration-200 origin-bottom pointer-events-none" style={{ zIndex: 999999 }}>
              Eliminar conexión
            </div>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = {
  removable: RemovableEdge,
};

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



const DelayNode = ({ data }: any) => (
  <div style={{ ...nodeStyle, borderTop: '4px solid #6b7280' }}>
    <Handle type="target" position={Position.Top} />
    <div style={headerStyle}>
      <span className="material-symbols-outlined text-sm">schedule</span>
      Espera (Delay)
    </div>
    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px' }}>
      Tiempo: {data.time || '1'} {data.unit || 'minutos'}
    </div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);

const WebhookNode = ({ data }: any) => (
  <div style={{ ...nodeStyle, borderTop: '4px solid #f97316' }}>
    <Handle type="target" position={Position.Top} />
    <div style={headerStyle}>
      <span className="material-symbols-outlined text-sm">webhook</span>
      Webhook (API)
    </div>
    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px', wordBreak: 'break-all' }}>
      {data.method || 'GET'} {data.url || 'https://...'}
    </div>
    <div style={{ fontSize: '10px', color: '#64748b' }}>Guardar en: {data.variable || 'ninguna'}</div>
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
  human: HumanNode,
  webhook: WebhookNode,
  delay: DelayNode,
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
  const parsedLoadedEdges = loadedEdges.map((e: any) => ({
    ...e,
    type: 'removable',
    markerEnd: { type: MarkerType.ArrowClosed }
  }));
  const [edges, setEdges, onEdgesChange] = useEdgesState(parsedLoadedEdges);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ 
      ...params, 
      type: 'removable', 
      markerEnd: { type: MarkerType.ArrowClosed } 
    }, eds)),
    [setEdges]
  );

  const onNodeClick = (e: any, node: any) => {
    setSelectedNode(node);
  };

  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulatorMessages, setSimulatorMessages] = useState<{role: string, content: string}[]>([]);
  const [simulatorInput, setSimulatorInput] = useState('');
  const [simulatorVars, setSimulatorVars] = useState<Record<string, any>>({});
  const [simulatorCurrentNode, setSimulatorCurrentNode] = useState<string>('');

  const handleSave = () => {
    // Validaciones basicas
    const startNode = nodes.find(n => n.type === 'start');
    if (!startNode) return alert("Error: No hay nodo de Inicio.");
    
    // Add schema version wrapper
    onSave({ nodes, edges, flow_schema_version: 2 });
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
          : type === 'webhook' ? { method: 'GET', url: 'https://api.example.com/data', variable: 'api_response' }
          : type === 'delay' ? { time: '1', unit: 'minutos' }
          : { text: 'Nuevo mensaje' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const processSimulatorTurn = (currentNodeId: string, currentVars: any, userMessage: string) => {
    let vars = { ...currentVars };
    let nextNodeId = currentNodeId;
    let node = nodes.find(n => n.id === nextNodeId);
    let handledUserInput = false;

    if (userMessage && node) {
      const outEdges = edges.filter(e => e.source === node!.id);
      if (node.type === 'buttons') {
        const edge = outEdges.find(e => e.sourceHandle?.toLowerCase() === userMessage.toLowerCase());
        if (edge) nextNodeId = edge.target;
        else if (outEdges.length > 0) nextNodeId = outEdges[0].target;
        handledUserInput = true;
      } else if (node.type === 'question') {
        if ((node.data as any)?.variable) vars[(node.data as any).variable] = userMessage;
        if (outEdges.length > 0) nextNodeId = outEdges[0].target;
        handledUserInput = true;
      } else {
        if (outEdges.length > 0) nextNodeId = outEdges[0].target;
        handledUserInput = true;
      }
      node = nodes.find(n => n.id === nextNodeId);
    }

    let iterations = 0;
    const botReplies: string[] = [];

    while (node && iterations < 20) {
      iterations++;
      let autoAdvance = false;

      if (node.type === 'start') {
        autoAdvance = true;
      } 
      else if (node.type === 'condition') {
        // Evaluate
        const varValue = vars[(node.data as any)?.variable || ''];
        const op = (node.data as any)?.operator || '==';
        const expected = (node.data as any)?.value || '';
        let result = false;
        try {
          const a = String(varValue||'').toLowerCase();
          const e = String(expected).toLowerCase();
          if (op==='==') result = (a===e);
          else if(op==='!=') result = (a!==e);
          else if(op==='contains') result = a.includes(e);
        } catch {}

        const edge = edges.find(e => e.source === node!.id && e.sourceHandle === (result ? 'true' : 'false'));
        if (edge) {
          nextNodeId = edge.target;
          node = nodes.find(n => n.id === nextNodeId);
          continue;
        } else break;
      }
      else if (node.type === 'message') {
        let text = (node.data as any)?.text || '';
        text = text.replace(/\{\{([^}]+)\}\}/g, (m: any, k: string) => vars[k.trim()] || m);
        botReplies.push(text);
        autoAdvance = true;
      }
      else if (node.type === 'media') {
        botReplies.push(`[${(node.data as any)?.mediaType || 'media'}: ${(node.data as any)?.url || ''}]`);
        autoAdvance = true;
      }
      else if (node.type === 'human') {
        botReplies.push('PAUSA - Asesor humano conectando...');
        break; // Stop
      }
      else if (node.type === 'webhook') {
        botReplies.push(`[Ejecutando Webhook ${(node.data as any)?.method || 'GET'}...]`);
        if ((node.data as any)?.variable) vars[(node.data as any).variable] = '{"simulated": true}';
        autoAdvance = true;
      }
      else if (node.type === 'buttons') {
        let text = (node.data as any)?.text || 'Opciones:';
        text = text.replace(/\{\{([^}]+)\}\}/g, (m: any, k: string) => vars[k.trim()] || m);
        const btns = ((node.data as any)?.buttons || []).map((b:any)=>`[${b.label}]`).join(' ');
        botReplies.push(`${text} ${btns}`);
        break; // Stop and wait for user
      }
      else if (node.type === 'question') {
        let text = (node.data as any)?.text || 'Pregunta:';
        text = text.replace(/\{\{([^}]+)\}\}/g, (m: any, k: string) => vars[k.trim()] || m);
        botReplies.push(text);
        break; // Stop and wait for user
      }

      if (autoAdvance) {
        const outEdges = edges.filter(e => e.source === node!.id);
        if (outEdges.length > 0) {
          nextNodeId = outEdges[0].target;
          node = nodes.find(n => n.id === nextNodeId);
        } else break;
      } else break;
    }

    if (botReplies.length > 0) {
      setTimeout(() => {
        setSimulatorMessages(prev => [
          ...prev, 
          ...botReplies.map(r => ({role: 'bot', content: r}))
        ]);
        setSimulatorVars(vars);
        setSimulatorCurrentNode(nextNodeId);
      }, 300);
    } else {
      setSimulatorVars(vars);
      setSimulatorCurrentNode(nextNodeId);
    }
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
          edgeTypes={edgeTypes}
          onNodeClick={onNodeClick}
          onEdgeClick={(e, edge) => {
            setEdges((eds) => eds.filter((ed) => ed.id !== edge.id));
          }}
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
            <button onClick={() => addNode('delay')} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1 text-slate-600"><span className="material-symbols-outlined text-[14px]">schedule</span> Espera</button>
            <button onClick={() => addNode('webhook')} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1 text-orange-600"><span className="material-symbols-outlined text-[14px]">webhook</span> API</button>
          </Panel>
          <Panel position="top-right">
            <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700">
              Guardar Flujo
            </button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Sidebar de Configuración */}
      <div className="w-80 bg-white border-l border-slate-200 flex flex-col z-10 shadow-xl overflow-hidden">
        
        {/* Toggle Editor/Simulador */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button onClick={() => setSimulatorOpen(false)} className={`flex-1 py-3 text-xs font-bold ${!simulatorOpen ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            PROPIEDADES
          </button>
          <button onClick={() => {
            setSimulatorOpen(true);
            setSimulatorMessages([]);
            setSimulatorVars({});
            const startNode = nodes.find(n => n.type === 'start');
            if(startNode) {
              setSimulatorCurrentNode(startNode.id);
              processSimulatorTurn(startNode.id, {}, '');
            }
          }} className={`flex-1 py-3 text-xs font-bold ${simulatorOpen ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            SIMULADOR
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!simulatorOpen ? (
            <>
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
            
                        
            {selectedNode.type === 'delay' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tiempo</label>
                  <input type="number" value={selectedNode.data.time || '1'} onChange={(e) => updateSelectedNodeData('time', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 outline-none" min="1" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unidad</label>
                  <select value={selectedNode.data.unit || 'minutos'} onChange={(e) => updateSelectedNodeData('unit', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 outline-none">
                    <option value="minutos">Minutos</option>
                    <option value="horas">Horas</option>
                    <option value="dias">Días</option>
                  </select>
                </div>
              </div>
            )}

            {selectedNode.type === 'webhook' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Método HTTP</label>
                  <select value={selectedNode.data.method || 'GET'} onChange={(e) => updateSelectedNodeData('method', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 outline-none">
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">URL (soporta variables {'{{var}}'})</label>
                  <input type="url" value={selectedNode.data.url || ''} onChange={(e) => updateSelectedNodeData('url', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 outline-none" placeholder="https://api.example.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Guardar respuesta en variable</label>
                  <input type="text" value={selectedNode.data.variable || ''} onChange={(e) => updateSelectedNodeData('variable', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 outline-none" placeholder="api_data" />
                </div>
              </div>
            )}
            
            <button onClick={() => setNodes(nodes.filter(n => n.id !== selectedNode.id))} className="w-full mt-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 flex justify-center items-center gap-1">
              <span className="material-symbols-outlined text-sm">delete</span> Eliminar Nodo
            </button>
            </div>
            )}
            </>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {simulatorMessages.map((msg, idx) => (
                  <div key={idx} className={`p-2 rounded-lg text-sm max-w-[85%] ${msg.role === 'bot' ? 'bg-indigo-50 text-indigo-900 self-start mr-auto' : 'bg-slate-100 text-slate-800 self-end ml-auto'}`}>
                    {msg.content}
                  </div>
                ))}
                {simulatorMessages.length === 0 && <div className="text-center text-xs text-slate-400 mt-10">Iniciando simulador...</div>}
              </div>
              <div className="mt-auto">
                <input 
                  type="text" 
                  value={simulatorInput} 
                  onChange={(e) => setSimulatorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && simulatorInput.trim()) {
                      const input = simulatorInput.trim();
                      setSimulatorMessages(prev => [...prev, {role: 'user', content: input}]);
                      setSimulatorInput('');
                      processSimulatorTurn(simulatorCurrentNode, simulatorVars, input);
                    }
                  }}
                  placeholder="Escribe un mensaje..."
                  className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
