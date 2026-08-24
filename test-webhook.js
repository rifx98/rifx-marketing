import { createHmac } from 'node:crypto';

const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
const appSecret = process.env.WHATSAPP_APP_SECRET;
const phoneNumberId = process.env.WHATSAPP_TEST_PHONE_NUMBER_ID;

if (!webhookUrl || !appSecret || !phoneNumberId) {
  throw new Error(
    'Configura WHATSAPP_WEBHOOK_URL, WHATSAPP_APP_SECRET y WHATSAPP_TEST_PHONE_NUMBER_ID antes de ejecutar esta prueba.',
  );
}

const parsedWebhookUrl = new URL(webhookUrl);
if (!['http:', 'https:'].includes(parsedWebhookUrl.protocol)) {
  throw new Error('WHATSAPP_WEBHOOK_URL debe usar http o https.');
}
if (!/^\d{6,30}$/.test(phoneNumberId)) {
  throw new Error('WHATSAPP_TEST_PHONE_NUMBER_ID no es válido.');
}

const testPayload = {
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "123456789",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "123456789",
              "phone_number_id": phoneNumberId
            },
            "contacts": [
              {
                "profile": {
                  "name": "Cliente de Prueba"
                },
                "wa_id": "593984111222"
              }
            ],
            "messages": [
              {
                "from": "593984111222",
                "id": "wamid.HBgLNTkzO...test1234",
                "timestamp": "1700000000",
                "text": {
                  "body": "Hola probando el logger de Meta"
                },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
};

const rawBody = JSON.stringify(testPayload);
const signature = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;

fetch(parsedWebhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-hub-signature-256': signature,
  },
  body: rawBody,
}).then(async (res) => {
  const body = await res.text();
  console.log(res.status, body);
  if (!res.ok) process.exitCode = 1;
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
