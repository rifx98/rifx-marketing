const body = {
  'object': 'whatsapp_business_account',
  'entry': [
    {
      'id': '1269450252053005',
      'changes': [
        {
          'value': {
            'messaging_product': 'whatsapp',
            'metadata': {
              'display_phone_number': '593995263177',
              'phone_number_id': '1099202103278354'
            },
            'contacts': [
              {
                'profile': {
                  'name': 'Rifx Marketing'
                },
                'wa_id': '593983910712',
                'user_id': 'EC.1029849446889445'
              }
            ],
            'messages': [
              {
                'from': '593983910712',
                'from_user_id': 'EC.1029849446889445',
                'id': 'wamid.HBgMNTkzOTgzOTEwNzEyFQIAEhgWM0VCMENENjBDRUU3MUFFQzNDQjMxMQA=',
                'timestamp': '1788051367',
                'text': {
                  'body': 'Hola'
                },
                'type': 'text'
              }
            ]
          },
          'field': 'messages'
        }
      ]
    }
  ]
};

const crypto = require('crypto');
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}
const PHONE_ID_PATTERN = /^\d{6,30}$/;
const MAX_INGRESS_MESSAGES = 1000;

function buildIngressEvents(body) {
  const events = [];
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value;
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      const destinationPhoneId = String(value?.metadata?.phone_number_id || '');
      if (messages.length > 0 && !PHONE_ID_PATTERN.test(destinationPhoneId)) continue;
      for (const message of messages) {
        if (!message || typeof message !== 'object') continue;
        const providerMessageId = String(message.id || '');
        const sender = String(message.from || '');
        if (!providerMessageId || providerMessageId.length > 200 || !PHONE_ID_PATTERN.test(sender)) continue;
        if (events.length >= MAX_INGRESS_MESSAGES) throw new Error('too_many_messages');
        const contacts = Array.isArray(value?.contacts)
          ? value.contacts.filter((contact) => String(contact?.wa_id || '') === sender).slice(0, 2)
          : [];
        const payload = {
          object: typeof body.object === 'string' ? body.object : 'whatsapp_business_account',
          entry: [{
            id: String(entry?.id || '').slice(0, 200),
            changes: [{
              field: typeof change?.field === 'string' ? change.field.slice(0, 80) : 'messages',
              value: {
                messaging_product: value?.messaging_product || 'whatsapp',
                metadata: value?.metadata || {},
                contacts,
                messages: [message],
              },
            }],
          }],
        };
        events.push({
          provider_message_id: providerMessageId,
          destination_phone_id: destinationPhoneId,
          payload_sha256: sha256Hex(JSON.stringify({
            message,
            metadata: value?.metadata || {},
          })),
          payload,
        });
      }
    }
  }
  return events;
}
console.log(JSON.stringify(buildIngressEvents(body), null, 2));
