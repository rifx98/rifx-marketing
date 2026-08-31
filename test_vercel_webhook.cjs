const https = require('https');
const crypto = require('crypto');

const rawBody = JSON.stringify({
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "1269450252053005",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "593995263177",
          "phone_number_id": "1099202103278354"
        },
        "contacts": [{
          "profile": { "name": "Rifx Marketing Test" },
          "wa_id": "593983910712",
          "user_id": "EC.1029849446889445"
        }],
        "messages": [{
          "from": "593983910712",
          "from_user_id": "EC.1029849446889445",
          "id": "wamid.TEST_MESSAGE_12345",
          "timestamp": Math.floor(Date.now() / 1000).toString(),
          "text": { "body": "test de vercel online" },
          "type": "text"
        }]
      },
      "field": "messages"
    }]
  }]
});

const secret = 'd5ca972b6c0df4199ca82e5a10d8be85';
const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

console.log("Sending payload of size:", rawBody.length);
console.log("Signature:", signature);

const options = {
  hostname: 'rifx-marketing.vercel.app',
  port: 443,
  path: '/api/whatsapp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-hub-signature-256': signature,
    'Content-Length': Buffer.byteLength(rawBody)
  }
};

const req = https.request(options, (res) => {
  console.log('statusCode:', res.statusCode);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(rawBody);
req.end();
