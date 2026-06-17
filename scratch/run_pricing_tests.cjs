const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const LOCAL_WEBHOOK_URL = 'http://localhost:3000/api/whatsapp';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const TEST_PHONE = '593983910712';
const PHONE_NUMBER_ID = '1099202103278354';
const TENANT_ID = '26db5d82-84e2-4af5-9458-add284631021';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  realtime: { transport: { send: () => {}, close: () => {} } }
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupDatabase() {
  console.log('🧹 Limpiando servicios de prueba anteriores...');
  await supabase.from('service_pricing').delete().eq('tenant_id', TENANT_ID);

  console.log('📦 Insertando servicios de prueba (UI Mock)...');
  
  // 1. Servicio con precio fijo
  await supabase.from('service_pricing').insert({
    tenant_id: TENANT_ID,
    service_name: 'Página Web Básica',
    category: 'desarrollo',
    description: 'Página web sencilla de 1 a 3 secciones para presencia online.',
    base_price: 250,
    currency: 'USD',
    billing_type: 'one_time',
    is_custom_quote: false,
    is_active: true
  });

  // 2. Servicio con rango de precio
  await supabase.from('service_pricing').insert({
    tenant_id: TENANT_ID,
    service_name: 'Gestión de Redes Sociales',
    category: 'marketing',
    description: 'Manejo mensual de Instagram y Facebook con posts y reels.',
    min_price: 300,
    max_price: 800,
    currency: 'USD',
    billing_type: 'monthly',
    is_custom_quote: false,
    is_active: true
  });

  // 3. Servicio con cotización personalizada
  await supabase.from('service_pricing').insert({
    tenant_id: TENANT_ID,
    service_name: 'Desarrollo de App Móvil',
    category: 'software',
    description: 'App para iOS y Android a la medida.',
    is_custom_quote: true,
    currency: 'USD',
    is_active: true
  });

  console.log('✅ Base de datos lista.');
}

async function cleanupTestConversation() {
  console.log(`🧹 Limpiando conversaciones previas para ${TEST_PHONE}...`);
  const { data: conv } = await supabase.from('conversations')
    .select('id').eq('phone_number', TEST_PHONE).eq('tenant_id', TENANT_ID).maybeSingle();

  if (conv) {
    await supabase.from('messages').delete().eq('conversation_id', conv.id);
    await supabase.from('conversations').delete().eq('id', conv.id);
  }
}

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
              metadata: { display_phone_number: '15550000000', phone_number_id: PHONE_NUMBER_ID },
              contacts: [{ profile: { name: 'Testing Bot' }, wa_id: TEST_PHONE }],
              messages: [{
                from: TEST_PHONE,
                id: 'wamid.' + crypto.randomBytes(16).toString('hex'),
                timestamp: Math.floor(Date.now() / 1000),
                text: { body: text },
                type: 'text'
              }]
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
    headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature },
    body: bodyStr
  });

  if (!res.ok) throw new Error(`Server status ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function getBotResponse() {
  const { data: conv } = await supabase.from('conversations')
    .select('id').eq('phone_number', TEST_PHONE).eq('tenant_id', TENANT_ID).maybeSingle();
  
  if (!conv) return null;

  const { data: msgs } = await supabase.from('messages')
    .select('content').eq('conversation_id', conv.id).eq('role', 'assistant')
    .order('created_at', { ascending: false }).limit(1);

  return msgs && msgs.length > 0 ? msgs[0].content : null;
}

async function runTest(name, message) {
  console.log(`\n▶️ TEST: ${name}`);
  console.log(`   User: "${message}"`);
  await sendWebhookMessage(message);
  await sleep(1500); // give the bot a moment to process via OpenAI and DB
  const reply = await getBotResponse();
  console.log(`   Bot: "${reply}"`);
}

async function main() {
  try {
    await setupDatabase();
    await cleanupTestConversation();

    await runTest('1. Precio fijo', 'Hola, ¿cuánto cuesta la Página Web Básica?');
    
    // reset conversation for isolated testing
    await cleanupTestConversation();
    await runTest('2. Rango de precio', 'Me interesa la Gestión de Redes Sociales, ¿qué precio tiene?');
    
    await cleanupTestConversation();
    await runTest('3. Cotización personalizada', '¿Tienen desarrollo de apps móviles? ¿Cuánto saldría?');
    
    await cleanupTestConversation();
    await runTest('4. Servicio inexistente (Pricing Guard)', '¿Cuánto cobran por lavar perros o hacer grooming?');

    console.log('\n✅ Pruebas finalizadas.');
  } catch (e) {
    console.error('Error general:', e);
  }
}

main();
