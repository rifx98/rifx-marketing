const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

async function main() {
  console.log("Loading Dropi config...");
  const res = await fetch(`${supabaseUrl}/rest/v1/config?tenant_id=eq.26db5d82-84e2-4af5-9458-add284631021&select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  if (!res.ok) {
    console.error("Failed to load config:", await res.text());
    return;
  }
  const data = await res.json();
  if (data.length === 0) {
    console.error("No config row found for tenant!");
    return;
  }
  const config = data[0];
  const parsed = JSON.parse(config.openai_key);
  const token = parsed.dropi_token;
  const productId = parsed.dropi_default_product_id;
  const price = parsed.dropi_default_price;

  console.log("Token starts with:", token ? token.substring(0, 20) + '...' : '(empty)');
  console.log("Product ID:", productId);
  console.log("Price:", price);

  if (!token) {
    console.error("No token configured!");
    return;
  }

  // Payload for Dropi Order
  const payload = {
    nombre: "Test Integracion Antigravity",
    telefono: "0999999999",
    direccion: "Calle de prueba 123 y Ave Central",
    ciudad: "Quito", // Let's try Quito
    metodo_pago: 1, // Contra entrega
    productos: [
      {
        id: productId,
        cantidad: 1,
        precio: price
      }
    ]
  };

  console.log("\nSending test payload to Dropi API...");
  console.log("Payload:", JSON.stringify(payload, null, 2));

  try {
    const dropiRes = await fetch('https://api.dropi.co/api/v1/orders', {
      method: 'POST',
      headers: {
        'dropi-integracion-key': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log("Status Code:", dropiRes.status);
    console.log("Headers:", JSON.stringify([...dropiRes.headers.entries()]));
    const text = await dropiRes.text();
    console.log("Response Body:", text);

    try {
      const result = JSON.parse(text);
      console.log("\nParsed JSON:", result);
    } catch {
      console.log("\nCould not parse response as JSON.");
    }
  } catch (err) {
    console.error("Request Error:", err);
  }
}

main().catch(console.error);
