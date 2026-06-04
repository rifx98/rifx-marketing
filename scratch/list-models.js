const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env.local manually
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    let val = parts.slice(1).join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
    process.env[key] = val;
  });
}

const req = https.request({
  hostname: 'api.groq.com',
  path: '/openai/v1/models',
  headers: {
    'Authorization': 'Bearer ' + process.env.GROQ_API_KEY
  }
}, (res) => {
  let d = '';
  res.on('data', (chunk) => d += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(d);
      if (data.data) {
        console.log('Available models:', data.data.map(m => m.id));
      } else {
        console.log('Response error:', data);
      }
    } catch (e) {
      console.error('Parsing error:', e, d);
    }
  });
});
req.on('error', (e) => console.error(e));
req.end();
