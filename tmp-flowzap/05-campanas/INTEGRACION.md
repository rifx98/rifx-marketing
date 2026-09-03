# Parte 5 — Campañas WhatsApp

Estas campañas son independientes de Meta Ads.

Puntos clave:
- cada campaña pertenece a un `whatsapp_account_id`;
- cada destinatario tiene su propio estado;
- existe idempotencia por `UNIQUE(campaign_id, phone)`;
- `claim_wa_campaign_batch` usa `FOR UPDATE SKIP LOCKED` para permitir workers concurrentes;
- no envíes miles de mensajes dentro de una request HTTP;
- reutiliza/expande el worker durable que ya usa `whatsapp_ingress`;
- aplica `consent-filter.ts` antes de insertar destinatarios;
- antes de enviar una plantilla, valida que esté aprobada y vigente según la integración Meta del CRM.
