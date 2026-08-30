const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://enbezuxcljmdsmtzqktp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac');

const payload = {
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
const sha256 = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

const events = [{
  provider_message_id: 'wamid.HBgMNTkzOTgzOTEwNzEyFQIAEhgWM0VCMENENjBDRUU3MUFFQzNDQjMxMQA=',
  destination_phone_id: '1099202103278354',
  payload_sha256: sha256,
  payload: payload
}];

supabase.rpc('enqueue_whatsapp_ingress_batch', { p_events: events })
  .then(r => console.log(JSON.stringify(r)))
  .catch(console.error);
