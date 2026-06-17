require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const res = await fetch(`${url}/rest/v1/config?select=*&limit=1`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    }
  });
  const data = await res.json();

  if (!data || data.length === 0) {
    console.log('No rows in config table');
    return;
  }

  const row = data[0];
  console.log('=== CONFIG TABLE COLUMNS ===');
  Object.keys(row).forEach(col => {
    const val = row[col];
    const type = val === null ? 'null' : typeof val;
    const preview = typeof val === 'string' ? val.substring(0, 40) : val;
    console.log(`  ${col}: [${type}]`);
  });
  console.log(`\nTotal: ${Object.keys(row).length} columns`);
  console.log('Has theme_config?', Object.keys(row).includes('theme_config'));
}

main().catch(console.error);
