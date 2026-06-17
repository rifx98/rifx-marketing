import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PROD_WEBHOOK_URL = 'https://rifx-marketinggithubio-main.vercel.app/api/whatsapp';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;

async function sendToWebhook(messageText) {
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
                phone_number_id: '1099202103278354'
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
                  id: 'wamid.HBgMNTkzOTgzOTEwNzEyFQIAERgSRTBEMDc1MUREMjc4ODg1QUM3AB==' + Date.now(),
                  timestamp: Math.floor(Date.now() / 1000),
                  text: { body: messageText },
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

  console.log(`\n--- Sending: "${messageText}" ---`);
  
  const res = await fetch(PROD_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature
    },
    body: bodyStr
  });

  console.log(`Webhook responded with Status: ${res.status}`);
  const text = await res.text();
  console.log('Response body:', text);
}

async function main() {
  await sendToWebhook("Sí, confírmame el Miércoles 10 de junio de 3:00 PM a 4:00 PM por favor.");
}

main().catch(console.error);
