# Orden de pruebas después de cada módulo

## Parte 1 — Multinúmero
- El número actual del tenant aparece como cuenta predeterminada.
- El webhook actual sigue pudiendo resolver el número existente.
- Un tenant no puede consultar cuentas de otro tenant.

## Parte 2 — Equipo y conversaciones
- Abrir conversación.
- Asignar asesor.
- Pausar/reactivar bot.
- Filtros por número de WhatsApp.
- No mezclar conversaciones de números distintos.

## Parte 3 — Flujos
- Flujo antiguo sigue cargando.
- Nuevo flujo con React Flow guarda `nodes + edges`.
- Menú, pregunta, condición, tag, media, humano y end funcionan.
- Un ciclo infinito se detiene.

## Parte 4 — Versiones
- Guardar crea versión.
- Publicar crea versión publicada.
- Restaurar no elimina historial.

## Parte 5 — Campañas
- Crear borrador.
- Generar destinatarios sin duplicados.
- Excluir NO_CONTACTAR.
- Procesar lote.
- Registrar sent/delivered/read/failed/replied.

## Parte 6 — IA Premium
- IA desactivada no afecta bots normales.
- Recarga crea movimiento de ledger.
- Consumo descuenta créditos de forma transaccional.
- Saldo insuficiente bloquea si hard stop está activo.
- Secretos no aparecen en respuestas del frontend.

## Parte 7 — Auditoría
- Publicar flujo, recargar créditos y cambiar WhatsApp producen eventos de auditoría.
