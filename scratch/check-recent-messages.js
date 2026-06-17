// Check recent messages using direct Supabase REST API
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = '26db5d82-84e2-4af5-9458-add284631021';

async function query(table, params) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  // Get last 5 conversations for this tenant
  const convos = await query('conversations', {
    select: 'id,customer_name,phone_number,status,updated_at',
    tenant_id: `eq.${TENANT_ID}`,
    order: 'updated_at.desc',
    limit: '5'
  });

  console.log(`\n=== Last 5 conversations ===\n`);
  convos.forEach((c, i) => {
    console.log(`[${i+1}] ${c.customer_name || 'Unknown'} (${c.phone_number})`);
    console.log(`    Status: ${c.status} | Updated: ${c.updated_at}`);
    console.log(`    ID: ${c.id}`);
    console.log('');
  });

  if (convos.length > 0) {
    const mainConvId = convos[0].id;
    console.log(`\n=== Last 15 messages for Conversation ${mainConvId} ===\n`);
    const messages = await query('messages', {
      select: 'id,role,content,created_at',
      conversation_id: `eq.${mainConvId}`,
      order: 'created_at.desc',
      limit: '15'
    });

    messages.reverse().forEach((msg, i) => {
      console.log(`[${i+1}] [${msg.created_at}] Role: ${msg.role}`);
      console.log(`    Content: ${msg.content}`);
      console.log('---');
    });
  }

  // Check webhook config
  const config = await query('config', {
    select: 'whatsapp_token,whatsapp_phone_id,openai_key',
    id: `eq.${TENANT_ID}`
  });

  console.log(`\n=== Tenant Config ===`);
  if (config.length) {
    const c = config[0];
    console.log(`  Token: ${c.whatsapp_token ? c.whatsapp_token.substring(0,20) + '...' : 'NOT SET'}`);
    console.log(`  Phone ID: ${c.whatsapp_phone_id || 'NOT SET'}`);
  }
}

main().catch(console.error);
