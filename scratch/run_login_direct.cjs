async function testLogin(body) {
  try {
    const res = await fetch('https://api.dropi.ec/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    console.log(`Payload keys: ${Object.keys(body).join(', ')}`);
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log(`Response:`, JSON.stringify(data));
    return { ok: res.ok, data };
  } catch (e) {
    console.error("Fetch error:", e.message);
    return { ok: false };
  }
}

async function main() {
  const email = "Bryanalex9763@gmail.com";
  const password = "Bryanynahomi@#1";

  console.log("--- TEST 1: Login WITH white_brand_id ---");
  await testLogin({
    email,
    password,
    white_brand_id: "df3e6b0bb66ceaadca4f84cbc371fd66e04d20fe51fc414da8d1b84d31d178de"
  });

  console.log("\n--- TEST 2: Login WITHOUT white_brand_id ---");
  await testLogin({
    email,
    password
  });
}

main().catch(console.error);
