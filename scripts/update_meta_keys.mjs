import fs from 'fs';

let content = fs.readFileSync('.env.local', 'utf8');

content = content.replace(/^FACEBOOK_APP_ID=.*$/m, 'FACEBOOK_APP_ID="1424738566081793"');
content = content.replace(/^FACEBOOK_APP_SECRET=.*$/m, 'FACEBOOK_APP_SECRET="d5ca972b6c0df4199ca82e5a10d8be85"');
content = content.replace(/^WHATSAPP_APP_SECRET=.*$/m, 'WHATSAPP_APP_SECRET="d5ca972b6c0df4199ca82e5a10d8be85"');
content = content.replace(/^WHATSAPP_VERIFY_TOKEN=.*$/m, 'WHATSAPP_VERIFY_TOKEN="rifx_wa_verify_token_2026_secure"');

fs.writeFileSync('.env.local', content);
console.log('Successfully updated Meta keys in .env.local!');
