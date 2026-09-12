import fs from 'fs';

let content = fs.readFileSync('.env.local', 'utf8');
content = content.replace(/^JWT_SECRET=.*$/m, 'JWT_SECRET="1face067ef3d8dc5837f10566b083ca662cec978d3cb5da6f73ab5d32d437dfc"');
fs.writeFileSync('.env.local', content);
console.log('Successfully updated JWT_SECRET in .env.local');
