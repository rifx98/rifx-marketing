import { createClient } from '@supabase/supabase-js';

// Polyfill to bypass the Realtime WS check in Node 20
global.WebSocket = class DummyWebSocket {};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Faltan variables de entorno!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log("--- Consultando social_accounts ---");
  const { data: accounts, error: errAcc } = await supabase.from('social_accounts').select('*');
  if (errAcc) {
    console.error("Error al obtener social_accounts:", errAcc.message);
  } else {
    console.log(`Encontradas ${accounts.length} cuentas en social_accounts:`);
    accounts.forEach(acc => {
      console.log(`ID: ${acc.id}, Tenant: ${acc.tenant_id}, Platform: ${acc.platform}, Username: ${acc.platform_username}, UserId: ${acc.platform_user_id}`);
    });
  }

  console.log("\n--- Consultando config ---");
  const { data: configs, error: errConf } = await supabase.from('config').select('*');
  if (errConf) {
    console.error("Error al obtener config:", errConf.message);
  } else {
    console.log(`Encontradas ${configs.length} filas en config:`);
    configs.forEach(cfg => {
      let ext = {};
      try {
        ext = JSON.parse(cfg.openai_key);
      } catch (e) {}
      console.log(`ID: ${cfg.id}, Tenant: ${cfg.tenant_id}`);
      console.log(`  facebook_access_token: ${ext.facebook_access_token ? 'Sí (largo: ' + ext.facebook_access_token.length + ')' : 'No'}`);
      console.log(`  facebook_page_id: ${ext.facebook_page_id || 'No'}`);
      console.log(`  facebook_ad_account_id: ${ext.facebook_ad_account_id || 'No'}`);
    });
  }
}

run();
