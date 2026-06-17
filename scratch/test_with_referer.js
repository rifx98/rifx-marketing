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

  console.log("Current Token starts with:", token ? token.substring(0, 30) + '...' : '(none)');

  const url = 'https://api.dropi.ec/api/orders/myorders';
  const payload = {
    nombre: "Test Referer Woo",
    telefono: "0999999999",
    direccion: "Calle Falsa 123",
    ciudad: "Quito",
    metodo_pago: 1, // Contra entrega
    productos: [
      {
        id: parsed.dropi_default_product_id || "119802",
        cantidad: 1,
        precio: parsed.dropi_default_price || 20
      }
    ]
  };

  const headersList = [
    {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Referer': 'https://rifx-marketinggithubio-main.vercel.app',
      'Origin': 'https://rifx-marketinggithubio-main.vercel.app'
    },
    {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  ];

  for (const [idx, headers] of headersList.entries()) {
    try {
      console.log(`\nTest #${idx + 1} Headers:`, JSON.stringify(headers, null, 2));
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      console.log(`Status:`, response.status);
      const text = await response.text();
      console.log(`Body:`, text);
    } catch (e) {
      console.error(e);
    }
  }
}

main().catch(console.error);
