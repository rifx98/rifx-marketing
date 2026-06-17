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

  const url = 'https://api.dropi.co/api/orders/myorders';

  const payloads = [
    {
      name: "Using Bearer Token",
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    },
    {
      name: "Using dropi-integration-key",
      headers: {
        'dropi-integration-key': token,
        'Content-Type': 'application/json',
      }
    },
    {
      name: "Using dropi-integracion-key",
      headers: {
        'dropi-integracion-key': token,
        'Content-Type': 'application/json',
      }
    }
  ];

  for (const p of payloads) {
    try {
      console.log(`Testing: ${p.name}...`);
      const dropiRes = await fetch(url, {
        method: 'POST',
        headers: p.headers,
        body: JSON.stringify({
          nombre: "Prueba Integracion",
          telefono: "0999999999",
          direccion: "Calle Falsa 123",
          ciudad: "Quito",
          metodo_pago: 1, // Contra entrega
          productos: [
            {
              id: "119802",
              cantidad: 1,
              precio: 20
            }
          ]
        })
      });
      console.log(`Status: ${dropiRes.status}`);
      const text = await dropiRes.text();
      console.log(`Response: ${text}\n`);
    } catch (e) {
      console.log(`Error: ${e.message}\n`);
    }
  }
}

main().catch(console.error);
