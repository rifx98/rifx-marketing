import { POST } from '../app/api/whatsapp/route';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Mock WebSocket globally for Node 20
(global as any).WebSocket = WebSocket;

async function main() {
  console.log("▶️ DIRECT WEBHOOK TEST INITIATED");

  // Disable signature verification
  delete process.env.FACEBOOK_APP_SECRET;

  // Create a mock Request object
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
    const responseText = await res.text();
    console.log("HTTP Response Body:", responseText);

    console.log("Waiting 6s for DB/Claude to finish...");
    await new Promise(r => setTimeout(r, 6000));

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
