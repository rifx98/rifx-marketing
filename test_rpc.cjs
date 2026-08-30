const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://enbezuxcljmdsmtzqktp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac');

const parsed = {"object":"whatsapp_business_account","entry":[{"id":"1269450252053005","changes":[{"value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"593995263177","phone_number_id":"1099202103278354"},"contacts":[{"profile":{"name":"Rifx Marketing"},"wa_id":"593983910712","user_id":"EC.1029849446889445"}],"messages":[{"from":"593983910712","from_user_id":"EC.1029849446889445","id":"wamid.HBgMNTkzOTgzOTEwNzEyFQIAEhgWM0VCMDQwRDRCRkQyMjgxNjI3Nzg0OAA=","timestamp":"1788053373","text":{"body":"hola"},"type":"text"}]},"field":"messages"}]}]};

const crypto = require('crypto');
function sha256Hex(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
const events = [];
const value = parsed.entry[0].changes[0].value;
const message = value.messages[0];
events.push({
  provider_message_id: message.id,
  destination_phone_id: value.metadata.phone_number_id,
  payload_sha256: sha256Hex(JSON.stringify({ message, metadata: value.metadata })),
  payload: parsed
});

console.time('rpc');
supabase.rpc('enqueue_whatsapp_ingress_batch', { p_events: events })
  .then(res => { console.timeEnd('rpc'); console.log(JSON.stringify(res, null, 2)); })
  .catch(err => { console.timeEnd('rpc'); console.error(err); });
