# Mapa de lo que se extrajo del FlowZap V3 original

## Del `server.js` original

Se extrajeron y adaptaron estas ideas al CRM:

- interpolación `{{variable}}` → `03-motor-flujos/flow-engine.ts`
- operadores de condición → `03-motor-flujos/flow-engine.ts`
- ejecución automática del flujo → `03-motor-flujos/flow-engine.ts`
- startSession / handleUserInput → `startFlow()` / `handleFlowInput()`
- validación → `03-motor-flujos/flow-validation.ts`
- compatibilidad del formato enlazado V2/V3 → `legacy-flow-adapter.ts`
- AI provider + créditos → `06-ai-premium/*`
- versiones → `04-versiones/*`
- conversaciones/equipo → `02-equipo-conversaciones/*`

## Lo que NO debe portarse literalmente

- servidor HTTP propio;
- lectura/escritura de JSON en disco;
- `.env` específico del MVP como sistema de configuración por cliente;
- rutas `/api/*` del `server.js` antiguo;
- HTML/CSS/JS del dashboard standalone;
- sistema de navegación propio.

El CRM ya posee servidor Next.js, Supabase, autenticación, navegación y diseño. FlowZap debe convertirse en funciones del CRM, no coexistir como una segunda app.
