const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (match) {
    let val = match[2].trim();
    // remove quotes if any
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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  // Query last 10 messages
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*, conversations(phone_number, name)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  console.log('--- LAST 20 MESSAGES ---');
  messages.reverse().forEach(msg => {
    console.log(`[${msg.created_at}] Role: ${msg.role}`);
    console.log(`Conv: ${msg.conversations?.name || 'Unknown'} (${msg.conversations?.phone_number || 'No Phone'})`);
    console.log(`Content: ${msg.content}`);
    console.log('-----------------------------------');
  });
}

run();
