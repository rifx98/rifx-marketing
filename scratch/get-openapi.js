import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });

  const schema = await res.json();
  const paths = Object.keys(schema.paths || {});
  const rpcs = paths.filter(p => p.startsWith('/rpc/'));
  console.log("Registered RPC functions:", rpcs);
  
  // Dump details of any exec_sql or similar rpc
  for (const rpc of rpcs) {
    if (rpc.includes('sql') || rpc.includes('exec') || rpc.includes('query')) {
      console.log(`\nDetails of ${rpc}:`, JSON.stringify(schema.paths[rpc], null, 2));
    }
  }
}

run().catch(console.error);
