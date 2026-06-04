import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const headers = {
  'apikey': supabaseServiceKey,
  'Authorization': `Bearer ${supabaseServiceKey}`,
  'Content-Type': 'application/json'
};

async function query(table, select = '*', order = 'created_at.desc', limit = 5) {
  const url = `${supabaseUrl}/rest/v1/${table}?select=${select}&order=${order}&limit=${limit}`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`Error querying ${table}:`, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Network error querying ${table}:`, err);
    return null;
  }
}

async function run() {
  console.log("--- LATEST SOCIAL POSTS ---");
  const posts = await query('social_posts', '*', 'created_at.desc', 3);
  console.log(JSON.stringify(posts, null, 2));

  console.log("\n--- LATEST SOCIAL PUBLICATIONS ---");
  const pubs = await query('social_publications', '*', 'created_at.desc', 5);
  console.log(JSON.stringify(pubs, null, 2));

  console.log("\n--- LATEST SOCIAL LOGS ---");
  const logs = await query('social_logs', '*', 'created_at.desc', 10);
  console.log(JSON.stringify(logs, null, 2));

  console.log("\n--- SOCIAL ACCOUNTS ---");
  const accounts = await query('social_accounts', 'id,tenant_id,platform,platform_user_id,platform_username,created_at', 'created_at.desc', 5);
  console.log(JSON.stringify(accounts, null, 2));
}

run();
