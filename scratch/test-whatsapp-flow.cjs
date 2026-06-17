// Simulate the exact WhatsApp AI flow to test fallback chain
require('dotenv').config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fetch tenant config
  const res = await fetch(`${supabaseUrl}/rest/v1/config?select=openai_key,ai_prompt&tenant_id=eq.26db5d82-84e2-4af5-9458-add284631021`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  const configs = await res.json();
  const config = configs[0];
  
  let extConfig = { openai_key: '', gemini_key: '', groq_key: '', model_selection: 'gpt-4o' };
  try { extConfig = { ...extConfig, ...JSON.parse(config.openai_key || '{}') }; } catch {}

  let selectedModel = extConfig.model_selection || 'gpt-4o';
  let isGroq = selectedModel.startsWith('llama') || selectedModel.startsWith('mixtral');
  let isGemini = selectedModel.startsWith('gemini');
  let isOpenAI = !isGroq && !isGemini;

  // Resolve API key
  let apiKey = '';
  if (isGroq) apiKey = extConfig.groq_key || process.env.GROQ_API_KEY || '';
  else if (isGemini) apiKey = extConfig.gemini_key || process.env.GEMINI_API_KEY || '';
  else apiKey = extConfig.openai_key || process.env.OPENAI_API_KEY || '';

  console.log(`Selected model: ${selectedModel}`);
  console.log(`Provider: ${isGemini ? 'Gemini' : isGroq ? 'Groq' : 'OpenAI'}`);
  console.log(`API Key: ${apiKey ? apiKey.substring(0, 12) + '...' : 'NONE'}`);

  const systemPrompt = config.ai_prompt || 'Eres un asesor de ventas.';
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Hola, qué servicios ofrecen?' }
  ];

  let aiResponse = '';

  // === STEP 1: Try primary provider ===
  console.log(`\n--- Step 1: Trying ${selectedModel} ---`);
  try {
    if (isGemini) {
      const systemMsg = chatMessages.find(m => m.role === 'system');
      const nonSystemMsgs = chatMessages.filter(m => m.role !== 'system');
      const geminiContents = [];
      for (const m of nonSystemMsgs) {
        const gemRole = m.role === 'assistant' ? 'model' : 'user';
        const last = geminiContents[geminiContents.length - 1];
        if (last && last.role === gemRole) { last.parts[0].text += '\n' + m.content; }
        else { geminiContents.push({ role: gemRole, parts: [{ text: m.content }] }); }
      }
      if (geminiContents.length > 0 && geminiContents[0].role !== 'user') {
        geminiContents.unshift({ role: 'user', parts: [{ text: 'Hola' }] });
      }
      const payload = { contents: geminiContents, generationConfig: { maxOutputTokens: 200, temperature: 0.7 } };
      if (systemMsg) { payload.systemInstruction = { parts: [{ text: systemMsg.content }] }; }

      const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const gemData = await gemRes.json();
      
      if (gemData?.error) {
        console.log(`❌ Gemini Error: ${gemData.error.code} - ${gemData.error.message?.substring(0, 100)}`);
        const gemError = new Error(`Gemini API Error: ${gemData.error.message}`);
        gemError.status = gemData.error.code;
        throw gemError;
      }
      aiResponse = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (aiResponse) console.log(`✅ Gemini OK: ${aiResponse.substring(0, 100)}...`);
    }
  } catch (aiError) {
    console.log(`❌ Primary failed: ${aiError.message?.substring(0, 80)}`);

    // === STEP 2: Fallback chain ===
    const isRateLimit = aiError.status === 429 || aiError.message?.includes('429') || aiError.message?.includes('RESOURCE_EXHAUSTED') || aiError.message?.includes('quota');
    const isGeminiError = aiError.message?.includes('Gemini');
    console.log(`   Is rate limit: ${isRateLimit}, Is Gemini error: ${isGeminiError}`);
    
    if (isRateLimit || isGeminiError) {
      console.log(`\n--- Step 2: Trying fallback providers ---`);
      
      const fallbackProviders = [];
      if (!isOpenAI && (extConfig.openai_key || process.env.OPENAI_API_KEY)) {
        const k = extConfig.openai_key || process.env.OPENAI_API_KEY || '';
        fallbackProviders.push({ name: 'OpenAI', key: k, model: 'gpt-4o-mini' });
      }
      if (!isGroq && (extConfig.groq_key || process.env.GROQ_API_KEY)) {
        const k = extConfig.groq_key || process.env.GROQ_API_KEY || '';
        fallbackProviders.push({ name: 'Groq', key: k, model: 'llama-3.3-70b-versatile', baseURL: 'https://api.groq.com/openai/v1' });
      }

      console.log(`   Fallback providers found: ${fallbackProviders.map(p => `${p.name}(key=${p.key ? p.key.substring(0, 8) + '...' : 'NONE'})`).join(', ')}`);

      for (const fb of fallbackProviders) {
        if (!fb.key || fb.key.length < 10) {
          console.log(`   ⏭ Skipping ${fb.name}: key too short (${fb.key?.length || 0} chars)`);
          continue;
        }
        try {
          console.log(`   🔄 Trying ${fb.name} (${fb.model})...`);
          const fbRes = await fetch(`${fb.baseURL || 'https://api.openai.com'}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${fb.key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: fb.model, messages: chatMessages, max_tokens: 200, temperature: 0.7 }),
          });
          const fbData = await fbRes.json();
          if (fbData.error) {
            console.log(`   ❌ ${fb.name} error: ${JSON.stringify(fbData.error).substring(0, 100)}`);
            continue;
          }
          aiResponse = fbData.choices?.[0]?.message?.content || '';
          if (aiResponse) {
            console.log(`   ✅ ${fb.name} OK: ${aiResponse.substring(0, 100)}...`);
            break;
          }
        } catch (fbErr) {
          console.log(`   ❌ ${fb.name} exception: ${fbErr.message}`);
        }
      }
    }
  }

  if (!aiResponse) {
    console.log('\n❌ ALL PROVIDERS FAILED. No response generated.');
    console.log('   → This is why the user sees "Disculpa, estoy procesando..."');
  } else {
    console.log(`\n✅ FINAL RESPONSE: ${aiResponse.substring(0, 200)}`);
  }
}

main().catch(console.error);
