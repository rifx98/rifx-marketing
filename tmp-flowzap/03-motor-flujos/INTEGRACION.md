# Parte 3 — Motor de Flujos

Este módulo es deliberadamente independiente del frontend.

- Mantiene `nodes + edges` para `@xyflow/react`.
- `normalizeFlowDocument()` acepta también el formato enlazado del FlowZap V2/V3 original.
- El motor soporta condiciones, menús, botones, preguntas, multimedia, etiquetas, esperas persistibles, humano, final, IA y hooks para API/webhook/subflow/template.
- Las esperas NO usan `setTimeout` largo: devuelven una acción `schedule` y guardan `resumeAt`, para que el worker/cron del CRM pueda reanudarlas de forma durable.
- El límite de pasos automáticos evita ciclos infinitos.

Integración recomendada:
1. Mantener el `FlowEditor.tsx` actual.
2. Hacer que guarde el documento normalizado `schemaVersion: 2`.
3. Antes de publicar ejecutar `validateFlow()`.
4. En `processFlowEngineMessage` usar `handleFlowInput()`.
5. Implementar los hooks con los servicios ya existentes del CRM.
