# Cómo usar este módulo con el FlowEditor actual

`FlowBuilderChrome.tsx` **NO reemplaza** React Flow ni dibuja nodos/edges.

Su objetivo es conservar la interfaz de FlowZap alrededor del editor que ya existe en el CRM:

- izquierda = paleta,
- centro = toolbar + TU ReactFlow actual,
- derecha = inspector.

Ejemplo conceptual:

```tsx
<FlowBuilderChrome
  flowName={flow.name}
  canvas={<ExistingReactFlowEditor ... />}
  inspector={<ExistingNodeInspector ... />}
  onAddNode={addNode}
  onSave={saveFlow}
  onPublish={publishFlow}
/>
```

Así no se crea un segundo constructor visual.
