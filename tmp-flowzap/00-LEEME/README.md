# FlowZap → CRM: Kit de integración por módulos

Este paquete NO es otra aplicación independiente. Está diseñado para portar las funciones de FlowZap V3 AI Premium al CRM existente por etapas.

## Regla principal

NO copies al CRM estos elementos del ZIP original de FlowZap:

- `server.js`
- `public/index.html`
- `public/app.js`
- `public/styles.css`
- carpeta `data/*.json`

Esos archivos pertenecen al MVP independiente y son precisamente lo que puede provocar que termine apareciendo un "segundo sistema" dentro del CRM.

## Arquitectura objetivo asumida

Este kit está preparado para el CRM descrito en el análisis previo:

- Next.js App Router
- Supabase/PostgreSQL
- autenticación propia mediante sesión/JWT
- arquitectura multi-tenant con `tenant_id`
- WhatsApp Cloud API ya existente
- `@xyflow/react` ya instalado para el constructor
- navegación visual existente que debe conservarse

## Orden recomendado

1. `01-whatsapp-multinumero`
2. `02-equipo-conversaciones`
3. `03-motor-flujos`
4. `04-versiones`
5. `05-campanas`
6. `06-ai-premium`
7. `07-auditoria`
8. `08-ui-headless`

No avances al módulo siguiente hasta que el anterior compile y sus pruebas básicas funcionen.

## Seguridad obligatoria

En todas las rutas del CRM:

- el `tenant_id` debe salir de la sesión autenticada;
- nunca aceptar `tenant_id` del body como autoridad;
- comprobar que `whatsapp_account_id` pertenece al tenant autenticado;
- reutilizar los guards/rate limiting/autorización que ya tiene el CRM;
- no devolver secretos, tokens ni claves de IA al navegador;
- registrar las operaciones administrativas sensibles.

## Cómo usar los prompts

La carpeta `09-prompts-claude` contiene prompts separados. Dale a Claude SOLO un módulo cada vez. Esto evita que vuelva a intentar integrar una aplicación completa paralela.

## Qué sí se porta desde FlowZap V3

- motor de flujos y variables;
- nodos start/message/menu/buttons/question/condition/media/tag/wait/human/end/ai;
- validación y protección contra ciclos;
- simulación;
- versiones;
- conversaciones y modo humano;
- campañas;
- IA Premium;
- créditos, consumo y margen;
- multinúmero;
- auditoría.

## Límite importante

Este kit contiene código desacoplado y migraciones reales, pero NO contiene el código fuente completo del CRM. Por eso la capa de integración visual y los imports exactos de helpers propios del CRM deben ajustarse contra el repositorio real. Los módulos de negocio están diseñados para evitar depender de nombres internos del CRM más allá de `tenant_id` y Supabase.
