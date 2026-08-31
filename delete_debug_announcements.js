const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=([^\n\r]+)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=([^\n\r]+)/);

if (!urlMatch || !keyMatch) {
  console.log('Credentials not found');
  process.exit(1);
}

const url = urlMatch[1].replace(/['"]/g, '').trim();
const key = keyMatch[1].replace(/['"]/g, '').trim();

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('announcements')
    .delete()
    .like('title', 'WEBHOOK_%');
  
  if (error) console.error(error);
  else console.log('Deleted debug announcements successfully');
}
run();
