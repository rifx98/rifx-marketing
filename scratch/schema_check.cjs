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

async function run() {
  try {
    // Query columns of conversations
    const url = `${supabaseUrl}/rest/v1/conversations?limit=1`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    });

    console.log('conversations columns response status:', res.status);
    const data = await res.json();
    if (data.length > 0) {
      console.log('conversations keys:', Object.keys(data[0]));
      console.log('conversations sample:', data[0]);
    } else {
      console.log('No conversations found');
    }
  } catch (err) {
    console.error('Error fetching columns:', err.message);
  }
}

run();
