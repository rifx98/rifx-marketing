import { SignJWT } from 'jose';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return new TextEncoder().encode(secret);
}

async function testPostConfig() {
  const tenantId = '26db5d82-84e2-4af5-9458-add284631021';
  const email = 'admin@rifx.com';
  
  // Generate token using jose
  const token = await new SignJWT({ tenantId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());
    
  console.log("Generated JWT Token:", token);
  
  // Fetch current config
  console.log("Fetching current config...");
  const getRes = await fetch('http://localhost:3000/api/panel/config', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!getRes.ok) {
    throw new Error(`GET failed: ${await getRes.text()}`);
  }
  const currentConfig = await getRes.json();
  console.log("Current config response:", currentConfig);
  
  // Change dropi_enabled to true (dropshipping mode)
  const payload = {
    ...currentConfig,
    dropi_enabled: false
  };
  
  console.log("Sending POST update...");
  const postRes = await fetch('http://localhost:3000/api/panel/config', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const postData = await postRes.json();
  console.log("POST Response status:", postRes.status);
  console.log("POST Response data:", postData);
}

testPostConfig().catch(console.error);
