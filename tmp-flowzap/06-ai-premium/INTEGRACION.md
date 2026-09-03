# Parte 6 — FlowZap AI Premium

La IA es OPCIONAL y está aislada por tenant.

## Cliente final
Puede ver:
- créditos disponibles;
- créditos usados;
- llamadas/consumo;
- precio comercial que decidas mostrar.

## Administración
Puede ver además:
- costo real del proveedor;
- ingreso estimado;
- margen estimado.

## Seguridad
- `api_key_encrypted` nunca debe incluirse en respuestas al navegador.
- `getSafeAIConfig()` elimina el secreto.
- La clave de cifrado vive solo en variables de entorno del servidor.
- Los créditos se modifican mediante `apply_ai_credit_delta()` con lock transaccional y ledger.

## Nota de proveedor
El cliente de OpenAI usa Responses API. Gemini usa `generateContent` por compatibilidad; Google mantiene ese endpoint aunque actualmente recomienda Interactions API para proyectos nuevos. Antes de producción conviene revisar el proveedor/modelo concreto configurado por cada tenant.
