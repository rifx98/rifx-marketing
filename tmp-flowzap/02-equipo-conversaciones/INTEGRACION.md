# Parte 2 — Equipo y Conversaciones

La finalidad es MEJORAR el módulo `conversations` existente. No crear un segundo Inbox.

Orden:
1. Ejecutar `032_team_and_conversations.sql`.
2. Vincular `team_agents.user_id` con el ID real del usuario autenticado cuando el CRM confirme cuál es la tabla de usuarios.
3. Incorporar los servicios.
4. Añadir filtros a la vista existente de Conversations.
5. Añadir panel lateral con contacto, tags, notas, asesor y número de WhatsApp.
6. Mantener el diseño visual actual del CRM.

El backend debe resolver `tenantId` desde la sesión y nunca desde el body.
