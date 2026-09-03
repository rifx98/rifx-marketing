# Contrato de integración para cualquier agente de código

Antes de cada cambio:
1. leer el archivo real que se modificará;
2. identificar funcionalidad existente equivalente;
3. extender en vez de duplicar;
4. no crear un segundo sistema visual;
5. conservar endpoints y datos existentes;
6. introducir cambios de esquema mediante migraciones incrementales;
7. ejecutar build/pruebas;
8. detenerse al finalizar el módulo solicitado.

## Prohibido
- copiar `FlowZap-V3/public` al CRM;
- ejecutar `FlowZap-V3/server.js` dentro del CRM;
- guardar datos SaaS en archivos JSON locales;
- confiar en `tenant_id` enviado por el navegador;
- crear un segundo login/sidebar/dashboard por comodidad;
- reemplazar el módulo Conversations por otro sistema desconectado;
- duplicar la configuración existente de WhatsApp sin migración.
