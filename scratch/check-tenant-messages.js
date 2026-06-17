import fs from 'fs';
import path from 'path';

// Manual parser for env
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = val;
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function check() {
  // Get all conversations for tenant 26db5d82-84e2-4af5-9458-add284631021
  const res = await fetch(`${supabaseUrl}/rest/v1/conversations?tenant_id=eq.26db5d82-84e2-4af5-9458-add284631021&order=updated_at.desc`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const convs = await res.json();
  console.log(`=== CONVERSATIONS FOR TENANT 26db5d82-84e2-4af5-9458-add284631021 (${convs.length}) ===`);
  convs.forEach(c => {
    console.log(`ID: ${c.id} | Phone: ${c.phone_number} | Name: ${c.customer_name} | Status: ${c.status} | Updated: ${c.updated_at}`);
  });

  if (convs.length > 0) {
    const ids = convs.map(c => c.id);
    const mRes = await fetch(`${supabaseUrl}/rest/v1/messages?conversation_id=in.(${ids.join(',')})&order=created_at.desc&limit=15`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    const msgs = await mRes.json();
    console.log("\n=== LATEST MESSAGES FOR THESE CONVERSATIONS ===");
    msgs.forEach(m => {
       console.log(`[${m.created_at}] Conversation: ${m.conversation_id} | ${m.role}: ${m.content}`);
    });
  }
}

check().catch(console.error);
