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
              "phone_number_id": "2213190156096315"
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

fetch('https://rifx-marketinggithubio-main.vercel.app/api/whatsapp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(testPayload)
}).then(res => res.json()).then(console.log).catch(console.error);
