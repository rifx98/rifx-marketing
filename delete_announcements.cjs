const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.production', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=([^\n\r]+)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=([^\n\r]+)/);

if (!urlMatch || !keyMatch) {
  console.log('Credentials not found in .env.production');
  process.exit(1);
}

const url = urlMatch[1].replace(/['"]/g, '').trim();
const key = keyMatch[1].replace(/['"]/g, '').trim();

if (!url || !key) {
  console.log('Credentials are empty');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('announcements')
    .delete()
    .like('title', 'WEBHOOK_%');
  
  if (error) console.error('Error deleting:', error);
  else console.log('Deleted debug announcements successfully');
}
run();
