import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function query(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  return r.json();
}

async function main() {
  // 1. Get configs
  const configs = await query('config?select=id,tenant_id,whatsapp_token,whatsapp_phone_id&limit=10');
  console.log('=== Configs in DB ===');
  if (Array.isArray(configs)) {
    for (const c of configs) {
      console.log(`Config ID: ${c.id}`);
      console.log(`  Tenant ID: ${c.tenant_id}`);
      console.log(`  Phone ID: ${c.whatsapp_phone_id || 'NOT SET'}`);
      console.log(`  Token: ${c.whatsapp_token ? c.whatsapp_token.substring(0, 25) + '... (len=' + c.whatsapp_token.length + ')' : 'NOT SET'}`);
      
      if (c.whatsapp_token && c.whatsapp_phone_id) {
        // Test token
        const tr = await fetch(`https://graph.facebook.com/v19.0/${c.whatsapp_phone_id}?fields=display_phone_number,verified_name`, {
          headers: { 'Authorization': `Bearer ${c.whatsapp_token}` }
        });
        const td = await tr.json();
        console.log(`  API Response Status: ${tr.status}`);
        if (td.error) {
          console.log(`  API Error: ${td.error.message}`);
        } else {
          console.log(`  API Phone: ${td.display_phone_number}`);
          console.log(`  API Name: ${td.verified_name}`);
        }
      }
      console.log('');
    }
  } else {
    console.log('Configs error:', configs);
  }
}

main().catch(console.error);
