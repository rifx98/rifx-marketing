const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const LOCAL_WEBHOOK_URL = 'http://localhost:3000/api/whatsapp';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const TEST_PHONE = '593983910712';
const PHONE_NUMBER_ID = '1099202103278354'; // Tenant RIFX Marketing
const TENANT_ID = '26db5d82-84e2-4af5-9458-add284631021';

// Setup Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  realtime: { transport: { send: () => {}, close: () => {} } }
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Clear conversation and messages for the test phone
async function cleanupTestConversation() {
  console.log(`🧹 Limpiando base de datos para el número ${TEST_PHONE}...`);
  
  // Find conversation
  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('phone_number', TEST_PHONE)
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();

  if (conv) {
    // Delete messages
    await supabase.from('messages').delete().eq('conversation_id', conv.id);
    // Delete appointments if any
    await supabase.from('appointments').delete().eq('conversation_id', conv.id);
    // Delete conversation
    await supabase.from('conversations').delete().eq('id', conv.id);
    console.log('   ✅ Limpieza completada.');
  } else {
    console.log('   ✅ No había conversaciones previas.');
  }
}

// Send simulated WhatsApp webhook message
async function sendWebhookMessage(text) {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123456789',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550000000',
                phone_number_id: PHONE_NUMBER_ID
              },
              contacts: [
                {
                  profile: { name: 'Cliente Prueba Automatizada' },
                  wa_id: TEST_PHONE
                }
              ],
              messages: [
                {
                  from: TEST_PHONE,
                  id: 'wamid.' + crypto.randomBytes(16).toString('hex'),
                  timestamp: Math.floor(Date.now() / 1000),
                  text: { body: text },
                  type: 'text'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  const bodyStr = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(bodyStr).digest('hex');

  const res = await fetch(LOCAL_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature
    },
    body: bodyStr
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Server returned status ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  return data;
}

// Get latest conversation details
async function getConversationDetails() {
  const { data: conv, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('phone_number', TEST_PHONE)
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();

  if (error) {
    console.error('Error fetching conversation:', error.message);
  }
  return conv;
}

// Get last assistant message
async function getLastAssistantMessage(convId) {
  const { data: msgs } = await supabase
    .from('messages')
    .select('content, role')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: false })
    .limit(5);

  const assistantMsg = msgs ? msgs.find(m => m.role === 'assistant') : null;
  return assistantMsg ? assistantMsg.content : null;
}

async function runTest(testNum, description, messageText) {
  console.log(`\n---------------------------------------------`);
  console.log(`🧪 TEST ${testNum}: ${description}`);
  console.log(`📤 Enviando: "${messageText}"`);
  console.log(`---------------------------------------------`);

  try {
    await sendWebhookMessage(messageText);
    console.log('📬 Mensaje procesado. Consultando base de datos...');
    
    // Give webhook a tiny bit to finish database insert/update just in case
    await sleep(500);

    const conv = await getConversationDetails();
    if (!conv) {
      console.log('❌ No se encontró conversación en la DB!');
      return;
    }

    const lastResponse = await getLastAssistantMessage(conv.id);

    console.log(`🤖 Respuesta bot: "${lastResponse}"`);
    console.log(`📊 Supabase Fields:`);
    console.log(`   - Status: ${conv.status}`);
    console.log(`   - Intent: ${conv.intent}`);
    console.log(`   - Sales Stage: ${conv.sales_stage}`);
    console.log(`   - Lead Score: ${conv.lead_score}`);
    console.log(`   - Last Objection: ${conv.last_objection || 'none'}`);
    console.log(`   - Urgency Level: ${conv.urgency_level || 'none'}`);
    console.log(`   - Budget Range: ${conv.budget_range || 'none'}`);
  } catch (err) {
    console.error(`❌ Error en Test ${testNum}:`, err.message);
  }
}

async function main() {
  console.log('🚀 Iniciando Suite de Pruebas Controladas...');
  
  await cleanupTestConversation();
  
  // 1. Test precio
  await runTest(1, 'Preguntando precio', 'Hola, me interesa el servicio de diseño web. ¿Cuánto cuesta?');
  
  // 2. Test objeción de precio
  await runTest(2, 'Objeción de precio', 'Está muy caro, no tengo ese presupuesto. ¿No hay algo más económico?');

  // 3. Test mensaje ambiguo
  await runTest(3, 'Mensaje ambiguo', 'Buenas tardes, quería saber más información');

  // 4. Test soporte técnico
  await runTest(4, 'Soporte técnico', 'Tengo un problema, el servicio no funciona bien y necesito ayuda');

  // 5. Test agendamiento
  await runTest(5, 'Pidiendo cita', 'Quiero agendar una reunión para hablar sobre los servicios');

  // 6. Test humano 1
  await runTest(6, 'Pidiendo humano (1/3)', 'Quiero hablar con un humano');

  // 7. Test humano 2
  await runTest(7, 'Pidiendo humano (2/3)', 'Necesito hablar con alguien real, no un bot');

  // 8. Test humano 3
  await runTest(8, 'Pidiendo humano (3/3) - Escalamiento', 'Pásame con un humano por favor');

  // 9. Test Pricing Guard - servicio no existente
  // Clean conversation to test fresh pricing guard for unknown service
  await cleanupTestConversation();
  await runTest(9, 'Pricing Guard - Servicio no oficial', 'Hola, ¿cuánto cuesta el servicio de Repostería Creativa?');

  console.log('\n=============================================');
  console.log('🏁 Fin de la suite de pruebas.');
  console.log('=============================================');
}

main().catch(console.error);
