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
  const productId = parsed.dropi_default_product_id;
  const price = parsed.dropi_default_price;

  // Since issuer is app.dropi.ec, let's target api.dropi.ec!
  const url = 'https://api.dropi.ec/api/orders/myorders';

  console.log(`Sending order payload to ${url}...`);

  try {
    const dropiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nombre: "Test Integracion Ecuador",
        telefono: "0999999999",
        direccion: "Calle de prueba 123 y Ave Central",
        ciudad: "Quito",
        metodo_pago: 1, // Contra entrega
        productos: [
          {
            id: productId,
            cantidad: 1,
            precio: price
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

main().catch(console.error);
