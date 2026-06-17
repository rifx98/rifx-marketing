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
  console.log("Fetching current platform_settings...");
  const getRes = await fetch(`${supabaseUrl}/rest/v1/platform_settings?select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
    }
  });

  if (!getRes.ok) {
    console.error("Failed to fetch current settings:", await getRes.text());
    process.exit(1);
  }

  const settingsList = await getRes.json();
  if (settingsList.length === 0) {
    console.error("No platform_settings found");
    process.exit(1);
  }

  const currentSettings = settingsList[0];
  const permissions = currentSettings.plan_permissions;
  console.log("Current permissions:", JSON.stringify(permissions, null, 2));

  // Add 'social' and 'appointments' to plus and master if not already present
  if (permissions.plus) {
    if (!permissions.plus.includes('social')) permissions.plus.push('social');
    if (!permissions.plus.includes('appointments')) permissions.plus.push('appointments');
  }
  if (permissions.master) {
    if (!permissions.master.includes('social')) permissions.master.push('social');
    if (!permissions.master.includes('appointments')) permissions.master.push('appointments');
  }

  console.log("New permissions to save:", JSON.stringify(permissions, null, 2));

  // Update in database
  const updateRes = await fetch(`${supabaseUrl}/rest/v1/platform_settings?id=eq.${currentSettings.id}`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      plan_permissions: permissions,
      updated_at: new Date().toISOString()
    })
  });

  if (updateRes.ok) {
    const updatedData = await updateRes.json();
    console.log("Successfully updated platform_settings:", JSON.stringify(updatedData, null, 2));
  } else {
    console.error("Failed to update platform_settings:", await updateRes.text());
  }
}

main().catch(console.error);
