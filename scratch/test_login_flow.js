const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log("=== DROPI ECUADOR LOGIN & ORDER TEST ===");
  const email = await askQuestion("Introduce tu email de Dropi Ecuador: ");
  const password = await askQuestion("Introduce tu contraseña de Dropi Ecuador: ");
  rl.close();

  console.log("\nIntentando hacer login en Dropi Ecuador...");
  
  try {
    const loginRes = await fetch('https://api.dropi.ec/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email.trim(),
        password: password.trim(),
        white_brand_id: "df3e6b0bb66ceaadca4f84cbc371fd66e04d20fe51fc414da8d1b84d31d178de"
      })
    });

    console.log("Status de Login:", loginRes.status);
    const loginData = await loginRes.json();
    
    if (!loginRes.ok || !loginData.token) {
      console.error("Error al iniciar sesión:", loginData);
      return;
    }

    const token = loginData.token;
    console.log("¡Login exitoso! Token obtenido (primeros 30 chars):", token.substring(0, 30) + '...');

    // Decode token to see audience/IPs
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        console.log("Token Payload decodificado:", JSON.stringify(payload, null, 2));
      }
    } catch (e) {
      console.warn("No se pudo decodificar el token:", e.message);
    }

    console.log("\nIntentando crear una orden de prueba en Dropi Ecuador usando este token...");
    // Usamos el ID de producto 119802 y precio 20 de la config
    const payload = {
      nombre: "Prueba Login Flow Antigravity",
      telefono: "0999999999",
      direccion: "Calle de prueba 123",
      ciudad: "Quito",
      metodo_pago: 1, // Contra entrega
      productos: [
        {
          id: "119802", // ID de producto de prueba
          cantidad: 1,
          precio: 20
        }
      ]
    };

    const orderRes = await fetch('https://api.dropi.ec/api/orders/myorders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log("Status de creación de orden:", orderRes.status);
    const orderData = await orderRes.text();
    console.log("Respuesta de Dropi:", orderData);

  } catch (err) {
    console.error("Error en la ejecución:", err);
  }
}

main().catch(console.error);
