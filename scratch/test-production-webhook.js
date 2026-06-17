import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROD_WEBHOOK_URL = 'https://rifx-marketinggithubio-main.vercel.app/api/whatsapp';
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
                display_phone_number: '593995263177',
                phone_number_id: '1099202103278354' // El nuevo Phone ID
              },
              contacts: [
                {
                  profile: { name: 'Cliente Prueba Prod' },
                  wa_id: '593983910712'
                }
              ],
              messages: [
                {
                  from: '593983910712',
                  id: 'wamid.HBgMNTkzOTgzOTEwNzEyFQIAERgSRTBEMDc1MUREMjc4ODg1QUM3AB==_test_prod',
                  timestamp: Math.floor(Date.now() / 1000),
                  text: { body: 'hola bot en produccion' },
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

  console.log('Enviando simulación de mensaje al webhook de producción...');
  console.log(`Firma generada: ${signature}`);

  try {
    const res = await fetch(PROD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature
      },
      body: bodyStr
    });

    console.log(`Webhook de producción respondió con Status: ${res.status}`);
    const text = await res.text();
    console.log('Respuesta del servidor:', text);
  } catch (err) {
    console.error('Error al conectar con el webhook de producción:', err.message);
  }
}

testWebhook().catch(console.error);
