const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Running SQL migration via exec_sql RPC...");

  const sql = `
    -- 1. Agregar columna de permisos de planes en platform_settings
    ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS plan_permissions JSONB DEFAULT '{
      "trial": ["dashboard", "settings", "billing"],
      "start": ["dashboard", "crm", "settings", "billing", "playground"],
      "advanced": ["dashboard", "crm", "settings", "billing", "playground", "banners", "segments"],
      "plus": ["dashboard", "crm", "settings", "billing", "playground", "banners", "segments", "analytics"],
      "master": ["dashboard", "crm", "settings", "billing", "playground", "campaigns", "banners", "segments", "analytics"]
    }'::jsonb;

    -- 2. Agregar columna de overrides de permisos en tenants
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS permission_overrides JSONB DEFAULT '{}'::jsonb;
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
  } else {
    console.log("Migration executed successfully!");
  }
}

main().catch(console.error);
