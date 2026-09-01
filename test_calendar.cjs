const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const lines = envContent.split('\n');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of lines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    supabaseKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
  }
}

console.log('URL:', supabaseUrl);

if (!supabaseUrl) throw new Error("No url");

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCalendar() {
  const { data: messages } = await supabase
    .from('messages')
    .select('tenant_id')
    .order('created_at', { ascending: false })
    .limit(1);

  if (messages && messages.length > 0) {
    const tenantId = messages[0].tenant_id;
    console.log('Last active Tenant ID:', tenantId);
    
    const { data: creds } = await supabase
      .from('calendar_credentials')
      .select('*')
      .eq('tenant_id', tenantId);
      
    console.log('Calendar Connected:', creds && creds.length > 0);
    if (creds && creds.length > 0) {
      console.log('Has access token:', !!creds[0].access_token);
    }
  } else {
    console.log('No messages found');
  }
}

checkCalendar();
