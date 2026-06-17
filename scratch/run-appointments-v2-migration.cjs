global.WebSocket = class DummyWebSocket {};
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Reading 006_appointments_v2.sql...");
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '006_appointments_v2.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log("Running SQL migration via exec_sql RPC...");
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
    console.error("Migration failed:", res.status, await res.text());
    process.exit(1);
  } else {
    console.log("Migration executed successfully!");
  }
}

main().catch(console.error);
