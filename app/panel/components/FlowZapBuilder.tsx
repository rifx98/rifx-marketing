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
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { FlowBuilderChrome } from './FlowBuilderChrome';
import { InspectorField, InspectorDivider, InspectorToggle } from './BuilderInspectorPrimitives';

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
      {/* Invisible wider path for better hover detection if needed */}
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
          <button
            title="Eliminar conexión"
            className="w-6 h-6 bg-white text-rose-500 rounded-full flex items-center justify-center shadow-md border border-slate-200 hover:scale-110 hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer opacity-70 hover:opacity-100 z-50 text-[12px]"
            onClick={(event) => {
              event.stopPropagation();
              setEdges((eds) => eds.filter((e) => e.id !== id));
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = {
  removable: RemovableEdge,
};

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
    <p className="text-slate-500 text-[11px]">{data.text || "Perfecto 👩‍💼 Pasaré el bot para que un asesor continúe la conversación."}</p>
  </div>
);

const ConditionNode = ({ data }: any) => (
  <div className={`${premiumNodeStyle} border-l-4 border-l-cyan-500`}>
    <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -6 }} />
    <NodeHeader icon="🔀" title={data.name || "Condición"} typeLabel="CONDICIÓN" color="#06b6d4" />
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 mt-2 text-[10px] text-slate-600">
      Si <strong>{data.variable || 'var'}</strong> {data.operator || '=='} <strong>{data.value || 'valor'}</strong>
    </div>
    <div className="flex justify-between mt-2 text-[9px] font-bold">
      <span className="text-emerald-600">Verdadero</span>
      <span className="text-rose-600">Falso</span>
    </div>
    <Handle type="source" position={Position.Right} id="true" style={{ ...handleStyle, top: '70%', right: -6, backgroundColor: '#10b981' }} />
    <Handle type="source" position={Position.Right} id="false" style={{ ...handleStyle, top: '90%', right: -6, backgroundColor: '#ef4444' }} />
  </div>
);

const MediaNode = ({ data }: any) => (
  <div className={`${premiumNodeStyle} border-l-4 border-l-pink-500`}>
    <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -6 }} />
    <NodeHeader icon="🖼️" title={data.name || "Multimedia"} typeLabel="MULTIMEDIA" color="#ec4899" />
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 mt-2 text-[10px] text-slate-600 break-all">
      {data.mediaType || 'Imagen'} {data.url ? `· ${data.url.substring(0, 20)}...` : '· Sin archivo'}
    </div>
    <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -6 }} />
  </div>
);

const TagNode = ({ data }: any) => (
  <div className={`${premiumNodeStyle} border-l-4 border-l-lime-500`}>
    <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -6 }} />
    <NodeHeader icon="🏷️" title={data.name || "Etiqueta"} typeLabel="ETIQUETA" color="#84cc16" />
    <p className="text-[10px] text-slate-600 mt-1">{data.action === 'remove' ? 'Quitar' : 'Agregar'}: <strong>{data.tag || 'tag'}</strong></p>
    <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -6 }} />
  </div>
);

const WaitNode = ({ data }: any) => (
  <div className={`${premiumNodeStyle} border-l-4 border-l-orange-400`}>
    <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -6 }} />
    <NodeHeader icon="⏳" title={data.name || "Espera"} typeLabel="ESPERA" color="#fb923c" />
    <p className="text-[10px] text-slate-600 mt-1">Pausa por <strong>{data.time || '1'} {data.unit || 'minutos'}</strong></p>
    <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -6 }} />
  </div>
);

const AiNode = ({ data }: any) => (
  <div className={`${premiumNodeStyle} border-l-4 border-l-indigo-500`}>
    <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -6 }} />
    <NodeHeader icon="🧠" title={data.name || "IA Premium"} typeLabel="IA PREMIUM" color="#6366f1" />
    <p className="text-[10px] text-slate-500 mt-1">Generará respuesta basada en conocimiento.</p>
    <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -6 }} />
  </div>
);

const WebhookNode = ({ data }: any) => (
  <div className={`${premiumNodeStyle} border-l-4 border-l-rose-500`}>
    <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -6 }} />
    <NodeHeader icon="🌐" title={data.name || "Llamada API"} typeLabel="WEBHOOK" color="#f43f5e" />
    <p className="text-[10px] text-slate-500 mt-1">{data.method || 'POST'} {data.url ? `${data.url.substring(0,25)}...` : 'URL sin definir'}</p>
    <Handle type="source" position={Position.Right} style={{ ...handleStyle, right: -6 }} />
  </div>
);

const EndNode = ({ data }: any) => (
  <div className={`${premiumNodeStyle} border-l-4 border-l-slate-700`}>
    <Handle type="target" position={Position.Left} style={{ ...handleStyle, left: -6 }} />
    <NodeHeader icon="⛔" title={data.name || "Final"} typeLabel="FINAL" color="#334155" />
    <p className="text-[10px] text-slate-500 mt-1">{data.text || "Conversación finalizada."}</p>
    {data.endAction && <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">[{data.endAction}]</p>}
  </div>
);

const nodeTypes: NodeTypes = {
  start: StartNode,
  message: MessageNode,
  menu: ButtonsNode,
  buttons: ButtonsNode,
  question: QuestionNode,
  human: HumanNode,
  condition: ConditionNode,
  media: MediaNode,
  tag: TagNode,
  wait: WaitNode,
  ai: AiNode,
  webhook: WebhookNode,
  end: EndNode,
};

// --- MAIN COMPONENT ---
export default function FlowZapBuilder({ initialNodes, initialEdges, initialFlowName, onSave, onPublish }: { initialNodes?: any[], initialEdges?: any[], initialFlowName?: string, onSave?: (name: string, nodes: any[], edges: any[]) => void, onPublish?: (name: string, nodes: any[], edges: any[]) => void }) {
  const defaultStartNode = { id: 'start_1', type: 'start', position: { x: 250, y: 150 }, data: {} };
  
  const [nodes, setNodes, onNodesChange] = useNodesState<any>(initialNodes || [defaultStartNode]);
  const parsedInitialEdges = (initialEdges || []).map((e: any) => ({
    ...e,
    type: 'removable',
    markerEnd: { type: MarkerType.ArrowClosed }
  }));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(parsedInitialEdges);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [flowName, setFlowName] = useState(initialFlowName || 'Mi chatbot');

  // Simulator states
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulatorMessages, setSimulatorMessages] = useState<{role: string, content: string}[]>([]);
  const [simulatorInput, setSimulatorInput] = useState('');
  const [simulatorVars, setSimulatorVars] = useState<Record<string, any>>({});
  const [simulatorCurrentNode, setSimulatorCurrentNode] = useState<string>('');
  const [simulatorBreadcrumbs, setSimulatorBreadcrumbs] = useState<string[]>([]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ 
      ...params, 
      type: 'removable', 
      markerEnd: { type: MarkerType.ArrowClosed } 
    }, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const newNode = {
      id: `${type}_${Date.now()}`,
      type,
      position: { x: Math.random() * 200 + 400, y: Math.random() * 200 + 100 },
      data: type === 'menu' || type === 'buttons' ? { name: 'Opciones', text: 'Elige:', buttons: [{ label: 'Opción 1' }] } 
          : type === 'question' ? { name: 'Pregunta', text: '¿Cual es tu nombre?', variable: 'nombre' }
          : type === 'condition' ? { name: 'Condición', variable: 'nombre', operator: '==', value: 'Juan' }
          : type === 'media' ? { name: 'Multimedia', mediaType: 'image', url: '', text: '', fileName: '' }
          : type === 'tag' ? { name: 'Etiqueta', action: 'add', tag: 'nuevo-cliente' }
          : type === 'wait' ? { name: 'Espera', time: '1', unit: 'minutos' }
          : type === 'ai' ? { name: 'IA Premium' }
          : type === 'end' ? { name: 'Fin' }
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

  const processSimulatorTurn = (currentNodeId: string, currentVars: any, userMessage: string, currentBreadcrumbs: string[]) => {
    let vars = { ...currentVars };
    let nextNodeId = currentNodeId;
    let node = nodes.find((n: any) => n.id === nextNodeId);
    let breadcrumbs = [...currentBreadcrumbs];

    if (userMessage && node) {
      const outEdges = edges.filter(e => e.source === node!.id);
      if (node.type === 'menu' || node.type === 'buttons') {
        const buttons = (node.data as any)?.buttons || [];
        const num = parseInt(userMessage, 10);
        let matchLabel = userMessage;
        if (!isNaN(num) && num > 0 && num <= buttons.length) {
          matchLabel = buttons[num - 1].label;
        }
        
        const edge = outEdges.find(e => e.sourceHandle?.toLowerCase() === matchLabel.toLowerCase());
        
        if (edge) nextNodeId = edge.target;
        else if (outEdges.length > 0) nextNodeId = outEdges[0].target;
      } else if (node.type === 'question') {
        if ((node.data as any)?.variable) vars[(node.data as any).variable] = userMessage;
        if (outEdges.length > 0) nextNodeId = outEdges[0].target;
      } else {
        if (outEdges.length > 0) nextNodeId = outEdges[0].target;
      }
      node = nodes.find((n: any) => n.id === nextNodeId);
    }

    let iterations = 0;
    const botReplies: string[] = [];

    while (node && iterations < 20) {
      iterations++;
      let autoAdvance = false;
      const nodeName = (node.data as any)?.name || node.type;
      if (!breadcrumbs.includes(nodeName)) {
        breadcrumbs.push(nodeName);
      }

      if (node.type === 'start') {
        autoAdvance = true;
      } 
      else if (node.type === 'condition') {
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
          node = nodes.find((n: any) => n.id === nextNodeId);
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
        botReplies.push(`[Archivo adjunto: ${(node.data as any)?.url || 'media'}]`);
        autoAdvance = true;
      }
      else if (node.type === 'human') {
        let text = (node.data as any)?.text || 'Perfecto 👩‍💼 Pasaré el bot para que un asesor continúe la conversación.';
        botReplies.push(text);
        break; 
      }
      else if (node.type === 'ai') {
        botReplies.push(`[Simulando IA Premium: procesando consulta...]`);
        autoAdvance = true;
      }
      else if (node.type === 'menu' || node.type === 'buttons') {
        let text = (node.data as any)?.text || 'Opciones:';
        text = text.replace(/\{\{([^}]+)\}\}/g, (m: any, k: string) => vars[k.trim()] || m);
        const btns = ((node.data as any)?.buttons || []).map((b:any, i:number)=>`${i+1}. ${b.label}`).join('\n');
        botReplies.push(`${text}\n${btns}`);
        break; 
      }
      else if (node.type === 'tag') {
        autoAdvance = true;
      }
      else if (node.type === 'wait') {
        botReplies.push(`[⏳ Pausa programada: ${(node.data as any)?.time || '1'} ${(node.data as any)?.unit || 'minutos'}]`);
        autoAdvance = true;
      }
      else if (node.type === 'end') {
        let text = (node.data as any)?.text || '⛔ Fin de la conversación.';
        let action = (node.data as any)?.endAction || 'Cerrar chat';
        botReplies.push(`[${text}] -> Acción: ${action}`);
        break;
      }
      else if (node.type === 'question') {
        let text = (node.data as any)?.text || 'Pregunta:';
        text = text.replace(/\{\{([^}]+)\}\}/g, (m: any, k: string) => vars[k.trim()] || m);
        botReplies.push(text);
        break; 
      }

      if (autoAdvance) {
        const outEdges = edges.filter(e => e.source === node!.id);
        if (outEdges.length > 0) {
          nextNodeId = outEdges[0].target;
          node = nodes.find((n: any) => n.id === nextNodeId);
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
        setSimulatorBreadcrumbs(breadcrumbs);
      }, 300);
    } else {
      setSimulatorVars(vars);
      setSimulatorCurrentNode(nextNodeId);
      setSimulatorBreadcrumbs(breadcrumbs);
    }
  };

  const startSimulator = () => {
    setSimulatorOpen(true);
    setSimulatorMessages([]);
    setSimulatorVars({});
    setSimulatorBreadcrumbs([]);
    const startNode = nodes.find((n: any) => n.type === 'start');
    if(startNode) {
      setSimulatorCurrentNode(startNode.id);
      processSimulatorTurn(startNode.id, {}, '', []);
    } else {
      setSimulatorMessages([{role: 'bot', content: '⚠️ Error: No hay nodo de Inicio en el flujo.'}]);
    }
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
      onEdgeClick={(e, edge) => {
        setEdges((eds) => eds.filter((ed) => ed.id !== edge.id));
      }}
      onPaneClick={() => setSelectedNode(null)}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
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

      {['message', 'menu', 'buttons', 'question', 'human', 'end'].includes(selectedNode.type) && (
        <InspectorField label="Contenido del mensaje" help="Texto que enviará el bot">
          <textarea 
            value={selectedNode.data.text || ''} 
            onChange={(e) => updateSelectedNodeData('text', e.target.value)}
          />
        </InspectorField>
      )}

      {selectedNode.type === 'end' && (
        <InspectorField label="Acción al finalizar" help="¿Qué debe pasar con el chat?">
          <select 
            value={selectedNode.data.endAction || 'Cerrar chat'} 
            onChange={(e) => updateSelectedNodeData('endAction', e.target.value)}
          >
            <option value="Cerrar chat">Cerrar chat / Resolver</option>
            <option value="Reiniciar bot">Reiniciar bot desde el Inicio</option>
            <option value="Mantener abierto">Mantener abierto (esperando al usuario)</option>
          </select>
        </InspectorField>
      )}

      {(selectedNode.type === 'menu' || selectedNode.type === 'buttons') && (
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

      {selectedNode.type === 'media' && (
        <>
          <InspectorField label="Tipo">
            <select value={selectedNode.data.mediaType || 'image'} onChange={(e) => updateSelectedNodeData('mediaType', e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'8px', border:'1px solid #e5e7eb', fontSize:'10px'}}>
              <option value="image">Imagen</option>
              <option value="video">Video</option>
              <option value="document">PDF / Documento</option>
              <option value="audio">Audio</option>
            </select>
          </InspectorField>
          <InspectorField label="URL PÚBLICA DEL ARCHIVO">
            <input type="text" value={selectedNode.data.url || ''} onChange={(e) => updateSelectedNodeData('url', e.target.value)} placeholder="https://..." />
          </InspectorField>
          <InspectorField label="TEXTO / DESCRIPCIÓN">
            <textarea value={selectedNode.data.text || ''} onChange={(e) => updateSelectedNodeData('text', e.target.value)} />
          </InspectorField>
          {selectedNode.data.mediaType === 'document' && (
            <InspectorField label="NOMBRE DEL ARCHIVO para documentos">
              <input type="text" value={selectedNode.data.fileName || ''} onChange={(e) => updateSelectedNodeData('fileName', e.target.value)} placeholder="catalogo.pdf" />
            </InspectorField>
          )}
        </>
      )}

      {selectedNode.type === 'condition' && (
        <>
          <InspectorField label="Variable a evaluar">
            <input type="text" value={selectedNode.data.variable || ''} onChange={(e) => updateSelectedNodeData('variable', e.target.value)} placeholder="nombre_variable" />
          </InspectorField>
          <InspectorField label="Condición">
            <select value={selectedNode.data.operator || '=='} onChange={(e) => updateSelectedNodeData('operator', e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'8px', border:'1px solid #e5e7eb', fontSize:'10px'}}>
              <option value="==">Es igual a</option>
              <option value="!=">No es igual a</option>
              <option value="contains">Contiene</option>
              <option value=">">Mayor que</option>
              <option value="<">Menor que</option>
            </select>
          </InspectorField>
          <InspectorField label="Valor esperado">
            <input type="text" value={selectedNode.data.value || ''} onChange={(e) => updateSelectedNodeData('value', e.target.value)} />
          </InspectorField>
        </>
      )}

      {selectedNode.type === 'tag' && (
        <>
          <InspectorField label="Acción">
            <select value={selectedNode.data.action || 'add'} onChange={(e) => updateSelectedNodeData('action', e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'8px', border:'1px solid #e5e7eb', fontSize:'10px'}}>
              <option value="add">Agregar etiqueta</option>
              <option value="remove">Quitar etiqueta</option>
            </select>
          </InspectorField>
          <InspectorField label="Nombre de la etiqueta">
            <input type="text" value={selectedNode.data.tag || ''} onChange={(e) => updateSelectedNodeData('tag', e.target.value)} />
          </InspectorField>
        </>
      )}

      {selectedNode.type === 'wait' && (
        <div style={{display:'flex', gap:'10px'}}>
          <div style={{flex:1}}>
            <InspectorField label="Tiempo">
              <input type="number" value={selectedNode.data.time || '1'} onChange={(e) => updateSelectedNodeData('time', e.target.value)} />
            </InspectorField>
          </div>
          <div style={{flex:1}}>
            <InspectorField label="Unidad">
              <select value={selectedNode.data.unit || 'minutos'} onChange={(e) => updateSelectedNodeData('unit', e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'8px', border:'1px solid #e5e7eb', fontSize:'10px'}}>
                <option value="segundos">Segundos</option>
                <option value="minutos">Minutos</option>
                <option value="horas">Horas</option>
                <option value="dias">Días</option>
              </select>
            </InspectorField>
          </div>
        </div>
      )}

      <InspectorDivider />

      <button onClick={deleteNode} style={{width:'100%', padding:'10px', background:'#fee2e2', color:'#ef4444', border:'none', borderRadius:8, fontWeight:'bold', cursor:'pointer', fontSize:11}}>
        Eliminar Bloque
      </button>
    </div>
  );

  return (
    <>
      <FlowBuilderChrome
        flowName={flowName}
        onFlowNameChange={setFlowName}
        dirty={false}
        canvas={canvas}
        inspector={inspector}
        onAddNode={addNode}
        onSimulate={startSimulator}
        onSave={() => onSave ? onSave(flowName, nodes, edges) : alert('Guardando flujo...')}
        onPublish={() => onPublish ? onPublish(flowName, nodes, edges) : alert('Publicando...')}
        onValidate={() => alert('Flujo validado correctamente.')}
      />

      {/* MODAL DEL SIMULADOR */}
      {simulatorOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#f8fafc] w-full max-w-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200" style={{ height: '80vh' }}>
            {/* Header */}
            <div className="bg-[#0f766e] text-white px-6 py-4 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-[15px] m-0">Simulador de conversación</h3>
                <p className="text-teal-100 text-[11px] m-0 mt-0.5">Prueba el flujo antes de publicarlo</p>
              </div>
              <button onClick={() => setSimulatorOpen(false)} className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Breadcrumbs */}
            {simulatorBreadcrumbs.length > 0 && (
              <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
                {simulatorBreadcrumbs.map((crumb, i) => (
                  <React.Fragment key={i}>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50">
                      {crumb}
                    </span>
                    {i < simulatorBreadcrumbs.length - 1 && <span className="text-slate-300 text-[10px] material-symbols-outlined">chevron_right</span>}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {simulatorMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'bot' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`p-3 rounded-2xl max-w-[85%] text-[13px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'bot' 
                      ? 'bg-white border border-slate-200 text-slate-700 shadow-sm rounded-tl-none' 
                      : 'bg-emerald-600 text-white rounded-tr-none shadow-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {simulatorMessages.length === 0 && (
                <div className="text-center text-slate-400 text-xs mt-10">Cargando simulador...</div>
              )}
            </div>

            {/* Footer Input */}
            <div className="bg-white border-t border-slate-200 p-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={simulatorInput}
                  onChange={(e) => setSimulatorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && simulatorInput.trim()) {
                      const input = simulatorInput.trim();
                      setSimulatorMessages(prev => [...prev, {role: 'user', content: input}]);
                      setSimulatorInput('');
                      processSimulatorTurn(simulatorCurrentNode, simulatorVars, input, simulatorBreadcrumbs);
                    }
                  }}
                  placeholder="Escribe una respuesta..."
                  className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
                <button 
                  onClick={() => {
                    if (simulatorInput.trim()) {
                      const input = simulatorInput.trim();
                      setSimulatorMessages(prev => [...prev, {role: 'user', content: input}]);
                      setSimulatorInput('');
                      processSimulatorTurn(simulatorCurrentNode, simulatorVars, input, simulatorBreadcrumbs);
                    }
                  }}
                  className="bg-[#10b981] hover:bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl text-[13px] transition-colors shadow-sm"
                >
                  Enviar
                </button>
              </div>
              <div className="mt-3">
                <button 
                  onClick={startSimulator}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  Reiniciar simulación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
