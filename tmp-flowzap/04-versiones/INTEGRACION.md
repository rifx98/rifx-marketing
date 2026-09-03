# Parte 4 — Versiones

Cada guardar/publicar/restaurar crea un snapshot nuevo; no se sobrescribe el historial.

- `flow_key` identifica el bot lógico.
- `version_number` crece por bot.
- `schema_version` permite compatibilidad futura.
- Restaurar significa cargar un snapshot antiguo y guardar una nueva versión `restored`; nunca borrar versiones posteriores.
