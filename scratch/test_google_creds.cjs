const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const encryptionKeySecret = env.ENCRYPTION_KEY;

if (!supabaseUrl || !supabaseServiceKey || !encryptionKeySecret) {
  console.error('Missing configuration variables');
  process.exit(1);
}

function getEncryptionKey() {
  return crypto.createHash('sha256').update(encryptionKeySecret).digest();
}

function decryptToken(ciphertext, ivHex, tagHex) {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

const tenantId = '26db5d82-84e2-4af5-9458-add284631021';

async function run() {
  try {
    const socialUrl = `${supabaseUrl}/rest/v1/social_accounts?tenant_id=eq.${tenantId}&platform=eq.google_calendar&limit=1`;
    const resSocial = await fetch(socialUrl, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    });
    const social = await resSocial.json();
    const account = social[0];

    if (!account) {
      console.log('No Google Calendar account connected for tenant:', tenantId);
      return;
    }

    console.log('Account metadata:');
    console.log('  id:', account.id);
    console.log('  platform_username:', account.platform_username);
    console.log('  token_expires_at:', account.token_expires_at);

    // Decrypt access token
    const decrypted = decryptToken(account.encrypted_access_token, account.encryption_iv, account.encryption_tag);
    console.log('Decrypted content:');
    const credentials = JSON.parse(decrypted);
    console.log('  access_token:', credentials.access_token ? credentials.access_token.substring(0, 15) + '...' : 'null');
    console.log('  refresh_token:', credentials.refresh_token ? credentials.refresh_token.substring(0, 15) + '...' : 'null');

    // Test token refresh if refresh token exists
    if (credentials.refresh_token) {
      console.log('Refreshing token using refresh token...');
      const clientId = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const clientSecret = env.GOOGLE_CLIENT_SECRET;
      
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: credentials.refresh_token,
          grant_type: 'refresh_token'
        })
      });

      const data = await res.json();
      if (data.error) {
        console.error('Token refresh failed:', data.error_description || data.error);
      } else {
        console.log('Token refreshed successfully!');
        console.log('  new access_token:', data.access_token ? data.access_token.substring(0, 15) + '...' : 'null');
        console.log('  expires_in:', data.expires_in);
      }
    } else {
      console.log('Cannot refresh token: refresh_token is missing/null!');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
