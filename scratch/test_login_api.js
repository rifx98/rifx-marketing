async function testLogin() {
  console.log("Haciendo POST a http://localhost:3000/api/auth/login con credenciales legacy...");
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin',
        password: 'rifx2026'
      })
    });
    
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error connecting to server:", error.message);
  }
}

testLogin();
