import { POST } from '../app/api/whatsapp/route';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Mock WebSocket globally for Node 20
(global as any).WebSocket = WebSocket;

// Save original fetch
const originalFetch = global.fetch;

// Mock fetch to intercept Groq and WhatsApp API calls
global.fetch = async (url: string | URL | Request, options?: any) => {
  const urlStr = url.toString();
  
  // 1. Intercept Groq/OpenAI calls
  if (urlStr.includes('api.groq.com') || urlStr.includes('api.openai.com')) {
    console.log("🟢 [MOCK] Intercepted LLM Call");
    // Simulate AI inventing a fake price and adding a SALES_META tag
    const fakeAiResponse = "El costo de la Página Web Básica es de $999 USD. Avísame si empezamos. \n\n[SALES_META:objection=precio|next_action=agendar_llamada]";
    
    return new Response(JSON.stringify({
      id: "mock-id",
      object: "chat.completion",
      created: Date.now(),
      model: "mock-llama",
      choices: [{
        index: 0,
        message: { role: "assistant", content: fakeAiResponse },
        finish_reason: "stop"
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // 2. Intercept WhatsApp Meta API calls
  if (urlStr.includes('graph.facebook.com') && urlStr.includes('/messages')) {
    console.log("🟢 [MOCK] Intercepted WhatsApp Message Send");
    const body = JSON.parse(options.body);
    console.log("📩 MOCK WHATSAPP RECEIVED PAYLOAD:");
    console.log(body.text.body);
    
    return new Response(JSON.stringify({
      messaging_product: "whatsapp",
      contacts: [{ input: "593983910712", wa_id: "593983910712" }],
      messages: [{ id: "wamid.mock" }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // 3. Let Supabase calls pass through to original fetch
  return originalFetch(url, options);
};

async function main() {
  console.log("▶️ DIRECT WEBHOOK TEST INITIATED (WITH LLM & WHATSAPP MOCKED)");

  // Disable signature verification
  delete process.env.FACEBOOK_APP_SECRET;

  const mockBody = {
    messages: [
      {
        from: "593983910712",
        text: { body: "Hola, ¿cuánto cuesta la Página Web Básica?" },
        type: "text",
      }
    ],
    contacts: [{ profile: { name: "Test User" }, wa_id: "593983910712" }]
  };

  const req = new Request('http://localhost:3000/api/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: mockBody }] }]
    })
  });

  try {
    const res = await POST(req as any);
    console.log("HTTP Response Status:", res.status);
    
    console.log("Waiting 3s for DB update...");
    await new Promise(r => setTimeout(r, 3000));

    // Restore fetch before using Supabase Client just in case
    global.fetch = originalFetch;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: messages } = await supabase
      .from('conversations')
      .select('message, sender_type')
      .eq('phone_number', '593983910712')
      .order('created_at', { ascending: false })
      .limit(2);

    console.log("--- LATEST MESSAGES IN DB ---");
    messages?.reverse().forEach(m => {
      console.log(`[${m.sender_type.toUpperCase()}]: ${m.message}`);
    });

  } catch (err) {
    console.error("Test failed:", err);
  }
}

main();
