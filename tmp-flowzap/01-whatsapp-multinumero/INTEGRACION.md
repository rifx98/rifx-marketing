# Parte 1 — Multinúmero

1. Ejecuta `031_whatsapp_accounts.sql`.
2. Añade `secret-crypto.ts` a una carpeta server-only del CRM.
3. Añade `whatsapp-account-service.ts` a la capa de servicios.
4. Cambia progresivamente las funciones de envío para recibir `whatsappAccountId`.
5. Para la cuenta migrada actual, `resolveWhatsAppCredentials()` seguirá usando `config.whatsapp_token` mientras `legacy_config_backed=true`.
6. Los números nuevos se guardan cifrados mediante el secreto del servidor.

No elimines todavía las columnas antiguas de `config`. La retirada del esquema legado debe hacerse en una migración posterior cuando todo el sistema ya use `whatsapp_accounts`.
