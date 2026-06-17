import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const customerPhone = '593984111222';
  
  // Query all conversations for this customer
  const res = await fetch(`${supabaseUrl}/rest/v1/conversations?phone_number=eq.${customerPhone}&select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const convs = await res.json();
  console.log(`Conversations for ${customerPhone}:`, convs);

  // Query all conversations in the DB
  const resAll = await fetch(`${supabaseUrl}/rest/v1/conversations?select=id,tenant_id,customer_name,phone_number,status,created_at&order=created_at.desc&limit=10`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const allConvs = await resAll.json();
  console.log(`\nLast 10 conversations in DB:`);
  for (const c of allConvs) {
    console.log(`  ID: ${c.id}, Tenant: ${c.tenant_id}, Customer: ${c.customer_name}, Phone: ${c.phone_number}, Created: ${c.created_at}`);
  }
}

main().catch(console.error);
