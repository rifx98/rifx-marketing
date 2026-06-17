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

  // Decode issuer
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      console.log("Token payload:", JSON.stringify(payload, null, 2));
    }
  } catch (e) {
    console.error("Decode error:", e.message);
  }

  // Endpoints to test
  const tests = [
    {
      url: 'https://api.dropi.ec/api/orders/myorders',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    },
    {
      url: 'https://api.dropi.ec/api/v1/orders',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    },
    {
      url: 'https://api.dropi.ec/api/orders/myorders',
      headers: { 'dropi-integracion-key': token, 'Content-Type': 'application/json' }
    },
    {
      url: 'https://api.dropi.ec/api/v1/orders',
      headers: { 'dropi-integracion-key': token, 'Content-Type': 'application/json' }
    },
    {
      url: 'https://api.dropi.co/api/v1/orders',
      headers: { 'dropi-integracion-key': token, 'Content-Type': 'application/json' }
    },
    {
      url: 'https://api.dropi.co/api/orders/myorders',
      headers: { 'dropi-integracion-key': token, 'Content-Type': 'application/json' }
    }
  ];

  const payload = {
    nombre: "Prueba Integracion",
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

  for (const [index, test] of tests.entries()) {
    try {
      console.log(`\nTest #${index + 1}: POST to ${test.url}`);
      console.log(`Headers:`, Object.keys(test.headers).join(', '));
      const res = await fetch(test.url, {
        method: 'POST',
        headers: test.headers,
        body: JSON.stringify(payload)
      });
      console.log(`Response Status:`, res.status);
      const text = await res.text();
      console.log(`Response Body:`, text.substring(0, 500));
    } catch (e) {
      console.error(`Error in test #${index + 1}:`, e.message);
    }
  }
}

main().catch(console.error);
