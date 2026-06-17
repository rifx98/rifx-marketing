async function testLogin(headers) {
  try {
    const res = await fetch('https://api.dropi.ec/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        email: "Bryanalex9763@gmail.com",
        password: "Bryanynahomi@#1"
      })
    });
    console.log(`Headers: ${Object.keys(headers).join(', ') || 'none'}`);
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text.substring(0, 200)}\n`);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

async function main() {
  console.log("Testing Dropi Ecuador login with different headers...");

  console.log("\nTest 1: Standard Browser User-Agent");
  await testLogin({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  console.log("\nTest 2: Browser User-Agent + Referer + Origin");
  await testLogin({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://app.dropi.ec/',
    'Origin': 'https://app.dropi.ec'
  });

  console.log("\nTest 3: Browser User-Agent + Referer + Origin + Accept headers");
  await testLogin({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://app.dropi.ec/',
    'Origin': 'https://app.dropi.ec',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
  });
}

main().catch(console.error);
