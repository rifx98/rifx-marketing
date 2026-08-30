const crypto = require('crypto');
const rawBody = '{"object":"whatsapp_business_account","entry":[{"id":"1269450252053005","changes":[{"value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"593995263177","phone_number_id":"1099202103278354"},"contacts":[{"profile":{"name":"Rifx Marketing"},"wa_id":"593983910712","user_id":"EC.1029849446889445"}],"messages":[{"from":"593983910712","from_user_id":"EC.1029849446889445","id":"wamid.HBgMNTkzOTgzOTEwNzEyFQIAEhgWM0VCMENDMkJGMzJEMTIwMTg5MUMxOAA=","timestamp":"1788052191","text":{"body":"hola"},"type":"text"}]},"field":"messages"}]}]}';
const secret = 'd5ca972b6c0df4199ca82e5a10d8be85';
const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
console.log('Expected: ' + expectedSignature);
console.log('Actual:   sha256=39289b8df7500e5dfeb31967330eda601f885af211c1a16c192a0e154cbd0031');
console.log('Match:    ' + (expectedSignature === 'sha256=39289b8df7500e5dfeb31967330eda601f885af211c1a16c192a0e154cbd0031'));
