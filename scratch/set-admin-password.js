import bcrypt from 'bcryptjs';

const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  const hash = bcrypt.hashSync('admin123', 10);
  console.log("Setting password hash for admin@rifx.com to:", hash);

  const res = await fetch(`${supabaseUrl}/rest/v1/tenants?email=eq.admin@rifx.com`, {
    method: 'PATCH',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      password_hash: hash
    })
  });

  if (!res.ok) {
    console.error("Error updating password:", await res.text());
    return;
  }
  const data = await res.json();
  console.log("Updated successfully:", data);
}

main().catch(console.error);
