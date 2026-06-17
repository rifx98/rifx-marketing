import { SignJWT } from 'jose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
}

async function testModeToggle() {
  const tenantId = 'f19d8bea-1fa9-4783-a10d-a45c7f691e81'; // Has null openai_key
  const email = 'bryanalex9763@gmail.com';
  
  const token = await new SignJWT({ tenantId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 1. Read current state
  console.log("=== PASO 1: Leer estado actual ===");
  let res = await fetch('http://localhost:3000/api/panel/config', { headers });
  let config = await res.json();
  console.log("  dropi_enabled:", config.dropi_enabled);

  // 2. Toggle to Dropshipping (dropi_enabled: true)
  console.log("\n=== PASO 2: Cambiar a Dropshipping (dropi_enabled: true) ===");
  res = await fetch('http://localhost:3000/api/panel/config', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...config, dropi_enabled: true })
  });
  let result = await res.json();
  console.log("  Save response:", result);

  // 3. Read back to verify
  console.log("\n=== PASO 3: Verificar que guardó dropi_enabled: true ===");
  res = await fetch('http://localhost:3000/api/panel/config', { headers });
  config = await res.json();
  console.log("  dropi_enabled:", config.dropi_enabled, config.dropi_enabled === true ? "✅ CORRECTO" : "❌ FALLO");

  // 4. Toggle to Services (dropi_enabled: false)
  console.log("\n=== PASO 4: Cambiar a Servicios (dropi_enabled: false) ===");
  res = await fetch('http://localhost:3000/api/panel/config', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...config, dropi_enabled: false })
  });
  result = await res.json();
  console.log("  Save response:", result);

  // 5. Read back to verify
  console.log("\n=== PASO 5: Verificar que guardó dropi_enabled: false ===");
  res = await fetch('http://localhost:3000/api/panel/config', { headers });
  config = await res.json();
  console.log("  dropi_enabled:", config.dropi_enabled, config.dropi_enabled === false ? "✅ CORRECTO" : "❌ FALLO");
}

testModeToggle().catch(console.error);
