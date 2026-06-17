const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  const res = await fetch(`${supabaseUrl}/rest/v1/config?tenant_id=eq.26db5d82-84e2-4af5-9458-add284631021&select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const data = await res.json();
  const parsed = JSON.parse(data[0].openai_key);
  const token = parsed.dropi_token;

  if (!token) {
    console.log("No token found");
    return;
  }

  console.log("Token:", token);
  const parts = token.split('.');
  if (parts.length === 3) {
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    console.log("Payload:", JSON.stringify(JSON.parse(payload), null, 2));
    const decodedPayload = JSON.parse(payload);
    if (decodedPayload.exp) {
      const expDate = new Date(decodedPayload.exp * 1000);
      console.log(`Expiration Date: ${expDate.toISOString()} (Timestamp: ${decodedPayload.exp})`);
      console.log(`Current Time: ${new Date().toISOString()}`);
      if (expDate < new Date()) {
        console.log("❌ The token has EXPIRED!");
      } else {
        console.log("✅ The token is still VALID!");
      }
    }
  } else {
    console.log("Token is not a valid 3-part JWT.");
  }
}

main().catch(console.error);
