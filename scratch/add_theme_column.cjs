require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  // Try to add theme_config column via exec_sql RPC
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: "ALTER TABLE config ADD COLUMN IF NOT EXISTS theme_config TEXT DEFAULT NULL;"
    })
  });

  console.log('RPC status:', res.status);
  const data = await res.text();
  console.log('Response:', data);

  if (res.status === 200) {
    // Verify
    const verifyRes = await fetch(`${url}/rest/v1/config?select=id,theme_config&limit=1`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const verifyData = await verifyRes.json();
    console.log('\nVerification:', verifyData);
    console.log('theme_config column exists:', verifyData[0] && 'theme_config' in verifyData[0]);
  } else {
    console.log('\nRPC failed. Attempting via Supabase Management API...');
    
    // Alternative: Try using the database URL directly via pg-compatible endpoint
    // Or we generate a migration SQL for the user to run manually
    console.log('\n=== MANUAL MIGRATION REQUIRED ===');
    console.log('Please run this SQL in Supabase Dashboard > SQL Editor:');
    console.log('---');
    console.log('ALTER TABLE config ADD COLUMN IF NOT EXISTS theme_config TEXT DEFAULT NULL;');
    console.log('---');
  }
}

main().catch(console.error);
