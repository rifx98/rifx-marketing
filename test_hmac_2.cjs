const crypto = require('crypto');
const rawBody = '{"object":"whatsapp_business_account","entry":[{"id":"1269450252053005","changes":[{"value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"593995263177","phone_number_id":"1099202103278354"},"contacts":[{"profile":{"name":"Rifx Marketing"},"wa_id":"593983910712","user_id":"EC.1029849446889445"}],"messages":[{"from":"593983910712","from_user_id":"EC.1029849446889445","id":"wamid.HBgMNTkzOTgzOTEwNzEyFQIAEhgWM0VCMDQwRDRCRkQyMjgxNjI3Nzg0OAA=","timestamp":"1788053373","text":{"body":"hola"},"type":"text"}]},"field":"messages"}]}]}';
const secret = 'd5ca972b6c0df4199ca82e5a10d8be85';
const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
console.log('Expected:', expectedSignature);
console.log('Actual:  ', 'sha256=8a9be5076bf148adef79ade32f3628e28fcf2caaf07fbb87e28e2955c074ec8e');
console.log('Match:   ', expectedSignature === 'sha256=8a9be5076bf148adef79ade32f3628e28fcf2caaf07fbb87e28e2955c074ec8e');
