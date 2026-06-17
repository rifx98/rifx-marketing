const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Deleting duplicate/old config row...");
  const res = await fetch(`${supabaseUrl}/rest/v1/config?id=eq.a06be08e-5df8-49b0-a4d4-f90fc4846db4`, {
    method: 'DELETE',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  if (!res.ok) {
    console.error("Error deleting old config:", await res.text());
  } else {
    console.log("Successfully deleted old config row a06be08e-5df8-49b0-a4d4-f90fc4846db4.");
  }
}

main().catch(console.error);
