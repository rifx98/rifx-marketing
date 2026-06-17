import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = '26db5d82-84e2-4af5-9458-add284631021';
const TO_NUMBER = '593983910712'; // El número del usuario/cliente de la conversación

async function main() {
  // 1. Obtener la configuración del tenant con el nuevo token
  const r = await fetch(`${SUPABASE_URL}/rest/v1/config?tenant_id=eq.${TENANT_ID}&select=whatsapp_token,whatsapp_phone_id`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  
  const d = await r.json();
  if (!d.length || !d[0].whatsapp_token || !d[0].whatsapp_phone_id) {
    console.error('No se encontró configuración de WhatsApp para el tenant.');
    return;
  }
  
  const token = d[0].whatsapp_token;
  const phoneId = d[0].whatsapp_phone_id;

  console.log(`Intentando enviar mensaje de prueba usando:`);
  console.log(`Phone ID: ${phoneId}`);
  console.log(`Token prefix: ${token.substring(0, 25)}...`);
  console.log(`Para el número: ${TO_NUMBER}`);

  // 2. Enviar mensaje de plantilla o texto (Nota: para iniciar conversación de WhatsApp a veces Meta requiere plantilla, pero si ya hay hilo activo puede funcionar texto directo)
  const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: TO_NUMBER,
      type: 'text',
      text: { body: 'Hola, esta es una prueba del bot de RIFX Marketing con el nuevo token. Si recibes este mensaje por favor responde cualquier cosa para verificar el bot. ¡Gracias!' },
    }),
  });

  const result = await response.json();
  console.log(`Status de envío: ${response.status}`);
  console.log('Resultado:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
