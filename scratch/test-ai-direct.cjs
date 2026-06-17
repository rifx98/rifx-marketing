const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

// We get the Groq key from tenant config:
const GROQ_KEY = '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'; 
const ENV_GROQ_KEY = process.env.GROQ_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

async function testGroq(key, label) {
  console.log(`Testing Groq with ${label}...`);
  const client = new OpenAI({
    apiKey: key,
    baseURL: 'https://api.groq.com/openai/v1',
    timeout: 5000 // 5 seconds timeout
  });
  
  try {
    const start = Date.now();
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 10
    });
    console.log(`✅ Groq ${label} success (took ${Date.now() - start}ms):`, completion.choices[0].message.content);
  } catch (err) {
    console.error(`❌ Groq ${label} failed:`, err.message);
  }
}

async function testGemini(key, label) {
  console.log(`Testing Gemini with ${label}...`);
  try {
    const start = Date.now();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Say hello' }] }]
      }),
      signal: AbortSignal.timeout(5000) // 5s timeout
    });
    const data = await res.json();
    if (data.error) {
      console.error(`❌ Gemini ${label} API Error:`, data.error.message);
    } else {
      console.log(`✅ Gemini ${label} success (took ${Date.now() - start}ms):`, data.candidates?.[0]?.content?.parts?.[0]?.text);
    }
  } catch (err) {
    console.error(`❌ Gemini ${label} failed:`, err.message);
  }
}

async function run() {
  await testGroq(GROQ_KEY, 'Tenant Config Groq Key');
  await testGroq(ENV_GROQ_KEY, 'Env Variable Groq Key');
  await testGemini(GOOGLE_API_KEY, 'Env GOOGLE_API_KEY');
}

run();
