import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const DEFAULT_NAMES = [
  'Cosmético Lavanda Oasis',
  'Suplemento Fuerza Explosiva',
  'Frescura Cítrica Solar',
  'Futurismo Cyberpunk',
  'Streetwear Urbano Rebelde',
  'Modelo Humano Realista (Moda/Deportes)'
];

const DEFAULT_IDS = [
  'cosmetic-lavender',
  'gym-suplement-force',
  'beauty-citric-fresh',
  'tech-cyber-glow',
  'fashion-streetwear',
  'ai-model-action'
];

async function deleteDefaultTemplates() {
  const headers = {
    'apikey': supabaseServiceKey,
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  console.log('Starting DB templates cleanup...');
  let totalDeleted = 0;

  // 1. Delete by Name
  for (const name of DEFAULT_NAMES) {
    const url = `${supabaseUrl}/rest/v1/templates?name=eq.${encodeURIComponent(name)}`;
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        const deleted = await res.json();
        if (deleted && deleted.length > 0) {
          console.log(`Deleted template by name: "${name}" (${deleted.length} rows)`);
          totalDeleted += deleted.length;
        }
      } else {
        const errText = await res.text();
        console.error(`Failed to delete "${name}": HTTP ${res.status} - ${errText}`);
      }
    } catch (e) {
      console.error(`Error deleting "${name}":`, e);
    }
  }

  // 2. Delete by template_id inside config_json
  for (const id of DEFAULT_IDS) {
    // using jsonb containment or path filtering if possible, or we can just get all templates and delete by matching id
    // To be perfectly safe and robust, let's fetch all remaining templates and delete those whose config_json.template_id matches a default ID
    const url = `${supabaseUrl}/rest/v1/templates?select=*`;
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const templates = await res.json();
        for (const tpl of templates) {
          const tplId = tpl.config_json?.template_id || tpl.config_json?.id;
          if (tplId === id || DEFAULT_NAMES.includes(tpl.name)) {
            const deleteUrl = `${supabaseUrl}/rest/v1/templates?id=eq.${tpl.id}`;
            const delRes = await fetch(deleteUrl, { method: 'DELETE', headers });
            if (delRes.ok) {
              console.log(`Deleted template by matching ID "${id}" or Name "${tpl.name}" (ID: ${tpl.id})`);
              totalDeleted++;
            }
          }
        }
      }
    } catch (e) {
      console.error(`Error filtering templates by config_json template_id:`, e);
    }
  }

  console.log(`Cleanup complete. Total deleted default templates: ${totalDeleted}`);
}

deleteDefaultTemplates();
