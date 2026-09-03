# Qué se recuperó de FlowZap V3 original

La interfaz original estaba concentrada en:
- `public/index.html`: shell/navegación/modales.
- `public/app.js`: renderDashboard, renderInbox, renderContacts, renderTeam, renderAI, renderBuilder, renderVersions, renderSettings.
- `public/styles.css`: estilos de tarjetas, inbox de 3 columnas, chat, nodos/inspector, AI premium, settings.

Este paquete separa esas áreas en componentes visuales independientes para no incrustar la app standalone dentro del CRM.

Campañas y Facturación se incluyen como módulos separados siguiendo el diseño que se definió después de V3, porque no formaban parte de la navegación ejecutable del ZIP V3 original.
