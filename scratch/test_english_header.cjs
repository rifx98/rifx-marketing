async function testRequest(url, headers, payload) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(payload)
    });
    console.log(`POST ${url}`);
    console.log(`Headers: ${Object.keys(headers).join(', ')}`);
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text.substring(0, 300)}\n`);
  } catch (e) {
    console.error(`Error: ${e.message}\n`);
  }
}

async function main() {
  const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vYXBwLmRyb3BpLmVjOjgwIiwiaWF0IjoxNzgwODM4MzA3LCJleHAiOjQ5MzY1MTE5MDcsIm5iZiI6MTc4MDgzODMwNywianRpIjoiQklCZkhOdXdGemcwUDFUZiIsInN1YiI6IjExNzY4IiwicHJ2IjoiODdlMGFmMWVmOWZkMTU4MTJmZGVjOTcxNTNhMTRlMGIwNDc1NDZhYSIsImF1ZCI6Ik1BU1RFUlRPT0xTIiwidG9rZW5fdHlwZSI6IklOVEVHUkFUSU9OUyIsIndiX2lkIjoxLCJpbnRlZ3JhdGlvbl90eXBlIjoiTUFTVEVSVE9PTFMiLCJpbnRlZ3JhdGlvbl90eXBlX2lkIjo0LCJpcF91cmwiOltdLCJpbnRlZ3JhdGlvbl91cmwiOiIifQ.1pLKmZcomfb80IXzkYzdJFu8PAZLTB7HU6biWZGacvE";

  const payload = {
    nombre: "Test English Header",
    telefono: "0999999999",
    direccion: "Calle de prueba 123",
    ciudad: "Quito",
    metodo_pago: 1, // Contra entrega
    productos: [
      {
        id: "119802",
        cantidad: 1,
        precio: 20
      }
    ]
  };

  // Test both headers on orders/myorders
  await testRequest('https://api.dropi.ec/api/orders/myorders', {
    'dropi-integration-key': token
  }, payload);

  await testRequest('https://api.dropi.ec/api/orders/myorders', {
    'dropi-integracion-key': token
  }, payload);

  // Test both headers on v1/orders
  await testRequest('https://api.dropi.ec/api/v1/orders', {
    'dropi-integration-key': token
  }, payload);

  await testRequest('https://api.dropi.ec/api/v1/orders', {
    'dropi-integracion-key': token
  }, payload);
}

main().catch(console.error);
