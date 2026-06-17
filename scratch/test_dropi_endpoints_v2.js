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

  const endpoints = [
    'https://api.dropi.co/orders/myorders',
    'https://api.dropi.co/orders',
    'https://api.dropi.co/myorders',
    'https://api.dropi.co/order',
    'https://api.dropi.co/api/orders/myorders',
    'https://api.dropi.co/api/orders',
    'https://api.dropi.co/api/myorders',
    'https://api.dropi.co/api/order'
  ];

  for (const url of endpoints) {
    try {
      const dropiRes = await fetch(url, {
        method: 'POST',
        headers: {
          'dropi-integracion-key': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: "Test",
          telefono: "0999999999",
          direccion: "Test",
          ciudad: "Test",
          metodo_pago: 1,
          productos: [{ id: "119802", cantidad: 1, precio: 20 }]
        })
      });
      console.log(`URL: ${url} -> Status: ${dropiRes.status}`);
      const text = await dropiRes.text();
      console.log(`Response: ${text.substring(0, 150)}...\n`);
    } catch (e) {
      console.log(`URL: ${url} -> Error: ${e.message}\n`);
    }
  }
}

main().catch(console.error);
