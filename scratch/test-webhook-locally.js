import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const LOCAL_WEBHOOK_URL = 'http://localhost:3000/api/whatsapp';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;

async function testWebhook() {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123456789',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550000000',
                phone_number_id: '1099202103278354' // El phone ID correcto de tu tenant
              },
              contacts: [
                {
                  profile: { name: 'Cliente Prueba Local' },
                  wa_id: '593983910712'
                }
              ],
              messages: [
                {
                  from: '593983910712',
                  id: 'wamid.HBgMNTkzOTgzOTEwNzEyFQIAERgSRTBEMDc1MUREMjc4ODg1QUM3AB==',
                  timestamp: Math.floor(Date.now() / 1000),
                  text: { body: 'Quiero agendar una cita' },
                  type: 'text'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  const bodyStr = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', APP_SECRET || '').update(bodyStr).digest('hex');

  console.log('Enviando simulación de mensaje al webhook local...');
  console.log(`Firma generada con APP_SECRET (${APP_SECRET ? 'SET' : 'MISSING'}): ${signature}`);

  try {
    const res = await fetch(LOCAL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature
      },
      body: bodyStr
    });

    console.log(`Webhook local respondió con Status: ${res.status}`);
    const data = await res.json();
    console.log('Respuesta del servidor:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error al conectar con el webhook local:', err.message);
  }
}

testWebhook().catch(console.error);
