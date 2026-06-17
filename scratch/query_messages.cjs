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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase config');
  process.exit(1);
}

async function run() {
  try {
    // Query last 30 messages
    const url = `${supabaseUrl}/rest/v1/messages?select=id,role,content,created_at,conversations(phone_number,customer_name)&order=created_at.desc&limit=30`;
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase REST error: ${res.status} ${errText}`);
    }

    const messages = await res.json();

    console.log('--- LAST 30 MESSAGES ---');
    messages.reverse().forEach(msg => {
      console.log(`[${msg.created_at}] Role: ${msg.role}`);
      console.log(`Conv: ${msg.conversations?.customer_name || 'Unknown'} (${msg.conversations?.phone_number || 'No Phone'})`);
      console.log(`Content: ${msg.content}`);
      console.log('-----------------------------------');
    });
  } catch (err) {
    console.error('Error fetching messages:', err.message);
  }
}

run();
