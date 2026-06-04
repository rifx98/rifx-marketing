import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

async function main() {
  console.log("Running SQL migration via exec_sql RPC...");

  const sql = `
    -- Agregar columna scheduled_at a social_publications
    ALTER TABLE social_publications ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
  `;

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!res.ok) {
    console.error("Migration failed:", await res.text());
    process.exit(1);
  } else {
    console.log("Migration executed successfully! Added scheduled_at column.");
  }
}

main().catch(console.error);
