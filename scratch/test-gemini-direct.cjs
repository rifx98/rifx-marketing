// Minimal Gemini API test - no supabase needed
require('dotenv').config({ path: '.env.local' });

async function main() {
  // Read the env vars
  const geminiKey = process.env.GEMINI_API_KEY;
  console.log(`GEMINI_API_KEY from env: ${geminiKey ? geminiKey.substring(0, 10) + '...' + geminiKey.substring(geminiKey.length - 5) : 'NOT SET'}`);
  
  if (!geminiKey) {
    console.log('❌ No GEMINI_API_KEY in .env.local');
    
    // Try to read config from supabase via REST
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      console.log('\nFetching config from Supabase...');
      const res = await fetch(`${supabaseUrl}/rest/v1/config?select=tenant_id,openai_key&limit=3`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      const configs = await res.json();
      
      for (const config of configs) {
        let ext = {};
        try { ext = JSON.parse(config.openai_key || '{}'); } catch { ext = {}; }
        console.log(`\n  Tenant: ${config.tenant_id}`);
        console.log(`  Model: ${ext.model_selection || 'default'}`);
        console.log(`  Gemini key: ${ext.gemini_key ? ext.gemini_key.substring(0, 10) + '...' + ext.gemini_key.substring(ext.gemini_key.length - 5) : 'NOT SET'}`);
        console.log(`  Groq key: ${ext.groq_key ? ext.groq_key.substring(0, 10) + '...' : 'NOT SET'}`);
        console.log(`  OpenAI key: ${ext.openai_key ? ext.openai_key.substring(0, 10) + '...' : 'NOT SET'}`);
        
        // Test this key
        const testKey = ext.gemini_key;
        if (testKey && ext.model_selection?.startsWith('gemini')) {
          await testGemini(testKey, ext.model_selection);
        }
      }
    }
    return;
  }
  
  await testGemini(geminiKey, 'gemini-2.0-flash');
}

async function testGemini(apiKey, model) {
  console.log(`\n===========================`);
  console.log(`Testing Gemini with model: ${model}`);
  console.log(`Key: ${apiKey.substring(0, 10)}...`);
  console.log(`===========================`);

  // Test 1: Simple call
  console.log('\n--- Test 1: Simple message ---');
  try {
    const payload1 = {
      contents: [{ role: 'user', parts: [{ text: 'Hola, responde brevemente' }] }],
      generationConfig: { maxOutputTokens: 100, temperature: 0.7 }
    };
    const res1 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload1),
    });
    const data1 = await res1.json();
    if (data1.error) {
      console.log(`❌ Error: ${JSON.stringify(data1.error)}`);
    } else {
      const text = data1?.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`✅ Response: ${text ? text.substring(0, 120) : 'EMPTY'}`);
    }
  } catch (e) {
    console.log(`❌ Exception: ${e.message}`);
  }

  // Test 2: With systemInstruction
  console.log('\n--- Test 2: With systemInstruction ---');
  try {
    const payload2 = {
      systemInstruction: { parts: [{ text: 'Eres un asesor de ventas de una empresa de marketing digital. Responde en español.' }] },
      contents: [{ role: 'user', parts: [{ text: 'Qué servicios ofrecen?' }] }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
    };
    const res2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload2),
    });
    const data2 = await res2.json();
    if (data2.error) {
      console.log(`❌ Error: ${JSON.stringify(data2.error)}`);
    } else {
      const text = data2?.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`✅ Response: ${text ? text.substring(0, 200) : 'EMPTY'}`);
    }
  } catch (e) {
    console.log(`❌ Exception: ${e.message}`);
  }

  // Test 3: OLD format (system as user - broken) 
  console.log('\n--- Test 3: OLD format (system as user role) ---');
  try {
    const payload3 = {
      contents: [
        { role: 'user', parts: [{ text: '[System Instructions]: Eres un asesor de ventas. Responde en español brevemente.' }] },
        { role: 'user', parts: [{ text: 'Hola, qué servicios ofrecen?' }] },
      ],
      generationConfig: { maxOutputTokens: 100, temperature: 0.7 }
    };
    const res3 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload3),
    });
    const data3 = await res3.json();
    if (data3.error) {
      console.log(`❌ Error: ${JSON.stringify(data3.error)}`);
      console.log(`   → THIS is the bug! Two consecutive 'user' messages!`);
    } else {
      const text = data3?.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`✅ Response: ${text ? text.substring(0, 120) : 'EMPTY'}`);
    }
  } catch (e) {
    console.log(`❌ Exception: ${e.message}`);
  }

  // Test 4: With history (like real WhatsApp conversation)
  console.log('\n--- Test 4: With chat history ---');
  try {
    const payload4 = {
      systemInstruction: { parts: [{ text: 'Eres un asesor de ventas. Responde en español brevemente.' }] },
      contents: [
        { role: 'user', parts: [{ text: 'Hola' }] },
        { role: 'model', parts: [{ text: '¡Hola! ¿En qué puedo ayudarte?' }] },
        { role: 'user', parts: [{ text: 'Qué servicios tienen?' }] },
      ],
      generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
    };
    const res4 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload4),
    });
    const data4 = await res4.json();
    if (data4.error) {
      console.log(`❌ Error: ${JSON.stringify(data4.error)}`);
    } else {
      const text = data4?.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`✅ Response: ${text ? text.substring(0, 200) : 'EMPTY'}`);
    }
  } catch (e) {
    console.log(`❌ Exception: ${e.message}`);
  }
}

main().catch(console.error);
