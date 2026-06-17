import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import crypto from 'crypto';

const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const keySecret = process.env.ENCRYPTION_KEY;
  if (!keySecret) {
    throw new Error('FATAL: ENCRYPTION_KEY environment variable is not set. Add it to .env.local');
  }
  return crypto.createHash('sha256').update(keySecret).digest();
}

function decryptToken(ciphertext, ivHex, tagHex) {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function test() {
  const tenantId = '26db5d82-84e2-4af5-9458-add284631021';
  console.log(`Testing getCalendarCredentials manually for tenant ${tenantId}...`);
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/social_accounts?select=*&tenant_id=eq.${tenantId}&platform=eq.google_calendar`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });
    if (!res.ok) {
      console.error("Supabase error:", await res.text());
      return;
    }
    const accounts = await res.json();
    console.log("Found account rows:", accounts.length);
    if (accounts.length === 0) return;
    const account = accounts[0];

    console.log("Encrypted Access Token exists:", !!account.encrypted_access_token);
    console.log("Encryption IV exists:", !!account.encryption_iv);
    console.log("Encryption Tag exists:", !!account.encryption_tag);

    const decrypted = decryptToken(account.encrypted_access_token, account.encryption_iv, account.encryption_tag);
    console.log("Decrypted tokens:", decrypted);
  } catch (err) {
    console.error("Error running test:", err);
  }
}

test();
