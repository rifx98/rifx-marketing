import crypto from 'crypto';

async function testSignature() {
  const url = 'https://rifx-marketinggithubio-main.vercel.app/api/whatsapp';
  const appSecret = 'd5ca972b6c0df4199ca82e5a10d8be85';

  const payload = {
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
                "phone_number_id": "2213190156096315"
              },
              "contacts": [
                {
                  "profile": {
                    "name": "Test User"
                  },
                  "wa_id": "593983910712"
                }
              ],
              "messages": [
                {
                  "from": "593983910712",
                  "id": "wamid.testsignaturecheck",
                  "timestamp": String(Math.floor(Date.now() / 1000)),
                  "text": {
                    "body": "Test ping"
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

  const rawBody = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  console.log("Sending signed payload to production...");
  console.log("Signature header:", signature);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signature
      },
      body: rawBody
    });
    console.log("Response Status:", res.status);
    console.log("Response Body:", await res.text());
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

testSignature();
