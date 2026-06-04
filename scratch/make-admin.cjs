const fs = require('fs');
const path = require('path');

// Read env file manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    env[match[1]] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing supabase URL or service role key");
  process.exit(1);
}

async function run() {
  try {
    const email = 'admin@rifx.online';
    const url = `${supabaseUrl}/rest/v1/tenants?email=eq.${encodeURIComponent(email)}`;
    console.log("Updating admin status for:", email);
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        is_admin: true
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`HTTP Error ${response.status}:`, text);
    } else {
      const data = await response.json();
      console.log("Success! Updated tenant:", JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error("Exception occurred:", e);
  }
}

run();
