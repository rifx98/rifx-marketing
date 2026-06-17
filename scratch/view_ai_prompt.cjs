const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
    env[match[1]] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const tenantId = '26db5d82-84e2-4af5-9458-add284631021';

async function run() {
  try {
    const configUrl = `${supabaseUrl}/rest/v1/config?tenant_id=eq.${tenantId}&limit=1`;
    const resConfig = await fetch(configUrl, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    });

    const config = (await resConfig.json())[0];
    if (config) {
      console.log('--- AI PROMPT ---');
      console.log(config.ai_prompt);
    } else {
      console.log('No config row found for tenant');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
