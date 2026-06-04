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

async function testTable(tableName) {
  try {
    const url = `${supabaseUrl}/rest/v1/${tableName}?select=*&limit=1`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Range-Unit': 'items',
        'Range': '0-0'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.log(`❌ Table '${tableName}' error:`, response.status, text);
    } else {
      console.log(`✅ Table '${tableName}' exists and queried successfully.`);
    }
  } catch (e) {
    console.error(`❌ Table '${tableName}' exception:`, e);
  }
}

async function testAll() {
  await testTable('tenants');
  await testTable('conversations');
  await testTable('messages');
  await testTable('announcements');
  await testTable('payments');
}

testAll();
