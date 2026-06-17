const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (match) {
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
    env[match[1]] = val;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const tenantId = '26db5d82-84e2-4af5-9458-add284631021';

function decodeExtendedConfig(stored) {
  const defaults = {
    openai_key: '', gemini_key: '', groq_key: '', alert_email: '',
    bulk_wa_token: '', bulk_wa_phone_id: '',
    model_selection: 'gpt-4o', confidence_threshold: 0.85, auto_classification: true,
    fal_key: '', visual_render_provider: 'flux',
    facebook_access_token: '', facebook_ad_account_id: '', facebook_page_id: '',
    dropi_enabled: false,
    dropi_token: '',
    dropi_default_product_id: '',
    dropi_default_price: 50,
    dropi_prompt: '',
  };
  if (!stored) return defaults;
  try {
    const parsed = JSON.parse(stored);
    return {
      openai_key: parsed.openai_key || '',
      gemini_key: parsed.gemini_key || '',
      groq_key: parsed.groq_key || '',
      alert_email: parsed.alert_email || '',
      bulk_wa_token: parsed.bulk_wa_token || '',
      bulk_wa_phone_id: parsed.bulk_wa_phone_id || '',
      model_selection: parsed.model_selection || 'gpt-4o',
      confidence_threshold: parsed.confidence_threshold ?? 0.85,
      auto_classification: parsed.auto_classification ?? true,
      fal_key: parsed.fal_key || '',
      visual_render_provider: parsed.visual_render_provider || 'flux',
      facebook_access_token: parsed.facebook_access_token || '',
      facebook_ad_account_id: parsed.facebook_ad_account_id || '',
      facebook_page_id: parsed.facebook_page_id || '',
      dropi_enabled: parsed.dropi_enabled ?? false,
      dropi_token: parsed.dropi_token || '',
      dropi_default_product_id: parsed.dropi_default_product_id || '',
      dropi_default_price: parsed.dropi_default_price ?? 50,
      dropi_prompt: parsed.dropi_prompt || '',
    };
  } catch {
    return { ...defaults, openai_key: stored };
  }
}

async function run() {
  try {
    // 1. Get config
    const configUrl = `${supabaseUrl}/rest/v1/config?tenant_id=eq.${tenantId}&limit=1`;
    const resConfig = await fetch(configUrl, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    });

    const config = (await resConfig.json())[0];
    if (config) {
      console.log('--- CONFIG ---');
      console.log('id:', config.id);
      console.log('whatsapp_phone_id:', config.whatsapp_phone_id);
      const decoded = decodeExtendedConfig(config.openai_key);
      console.log('dropi_enabled:', decoded.dropi_enabled);
      console.log('model_selection:', decoded.model_selection);
    } else {
      console.log('No config row found for tenant');
    }

    // 2. Get social accounts
    const socialUrl = `${supabaseUrl}/rest/v1/social_accounts?tenant_id=eq.${tenantId}`;
    const resSocial = await fetch(socialUrl, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    });
    const social = await resSocial.json();
    console.log('--- SOCIAL ACCOUNTS ---');
    console.log(social.map(s => ({
      id: s.id,
      platform: s.platform,
      platform_username: s.platform_username,
      expires: s.token_expires_at
    })));
  } catch (err) {
    console.error('Error fetching tenant config:', err.message);
  }
}

run();
