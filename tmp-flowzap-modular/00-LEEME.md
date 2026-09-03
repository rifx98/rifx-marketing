# FlowZap UI Modular para integrar dentro de un CRM existente

Este paquete contiene **solo la interfaz modularizada** de FlowZap. Se extrajo/reconstruyó a partir de la interfaz real de FlowZap V3 AI Premium (`public/index.html`, `public/app.js`, `public/styles.css`) y de las pantallas de Campañas/Facturación diseñadas posteriormente.

## MUY IMPORTANTE

Este paquete **NO es una aplicación independiente**.

No contiene:
- servidor propio,
- sidebar principal obligatorio,
- autenticación,
- base de datos,
- rutas API,
- almacenamiento,
- configuración independiente de WhatsApp.

Cada componente recibe datos y acciones mediante `props`. Esto permite integrarlo dentro del CRM real sin duplicar arquitectura.

## Orden recomendado

1. Dashboard
2. Conversaciones
3. Contactos
4. Equipo
5. Constructor visual
6. Versiones
7. WhatsApp Settings
8. Campañas
9. AI Premium
10. Facturación

No integres dos módulos a la vez. Después de cada módulo ejecuta build/tests y revisa visualmente.

## Diseño

Los componentes conservan el lenguaje visual de FlowZap:
- tarjetas blancas,
- bordes suaves,
- verde WhatsApp/FlowZap,
- pills de estado,
- bandeja en tres columnas,
- constructor con paleta/canvas/inspector,
- panel AI con métricas y créditos.

Los estilos están aislados con CSS Modules para reducir colisiones con el CRM.

## Integración

No copies el código tal cual sin revisar el proyecto real. Claude debe:
1. inspeccionar el componente actual equivalente,
2. reutilizar rutas/datos existentes,
3. adaptar los props a esos datos,
4. conservar la navegación y layout del CRM,
5. NO agregar otro sidebar ni otro sistema de autenticación.
