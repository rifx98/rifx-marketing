// Script para probar los recordatorios de citas SIN esperar días
// Crea una cita de prueba a 2 horas de ahora y dispara el cron manualmente

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: require('ws') } }
);

// ─── CONFIGURACIÓN DE PRUEBA ──────────────────────────────────────────────
// Pon TU número de WhatsApp aquí (con código de país, sin +)
const TEST_PHONE = '593983910712'; // ← CAMBIA ESTO a tu número real
const TEST_NAME = 'Prueba Recordatorio';
const TEST_SERVICE = 'Asesoría de Prueba';
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 === PROBADOR DE RECORDATORIOS DE CITAS ===\n');

  // 1. Obtener el tenant_id del primer config
  const { data: config } = await supabase
    .from('config')
    .select('tenant_id, whatsapp_token, whatsapp_phone_id')
    .not('whatsapp_token', 'is', null)
    .limit(1)
    .single();

  if (!config) {
    console.error('❌ No se encontró configuración de WhatsApp en la DB');
    return;
  }
  console.log(`✅ Tenant: ${config.tenant_id}`);
  console.log(`✅ WhatsApp Phone ID: ${config.whatsapp_phone_id ? '✓ configurado' : '❌ NO configurado'}`);
  console.log(`✅ WhatsApp Token: ${config.whatsapp_token ? '✓ configurado' : '❌ NO configurado'}\n`);

  // 2. Buscar o crear conversación de prueba
  let { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('phone_number', TEST_PHONE)
    .eq('tenant_id', config.tenant_id)
    .single();

  if (!conv) {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        phone_number: TEST_PHONE,
        customer_name: TEST_NAME,
        tenant_id: config.tenant_id,
        status: 'chatting'
      })
      .select('id')
      .single();
    conv = newConv;
    console.log(`📝 Conversación de prueba creada: ${conv.id}`);
  } else {
    console.log(`📝 Conversación existente: ${conv.id}`);
  }

  // 3. Crear 3 citas de prueba en diferentes ventanas de tiempo
  const now = new Date();

  const tests = [
    {
      label: 'Recordatorio 30min',
      time: new Date(now.getTime() + 30 * 60 * 1000), // 30 min desde ahora
      fields: { reminder_24h_sent: true, reminder_2h_sent: true, reminder_30m_sent: false }
    },
    {
      label: 'Recordatorio 2h',
      time: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 horas desde ahora
      fields: { reminder_24h_sent: true, reminder_2h_sent: false, reminder_30m_sent: false }
    },
    {
      label: 'Recordatorio 24h',
      time: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 horas desde ahora
      fields: { reminder_24h_sent: false, reminder_2h_sent: false, reminder_30m_sent: false }
    },
  ];

  for (const test of tests) {
    const { data: appt, error } = await supabase
      .from('appointments')
      .insert({
        tenant_id: config.tenant_id,
        conversation_id: conv.id,
        customer_name: TEST_NAME,
        phone_number: TEST_PHONE,
        service: `${TEST_SERVICE} (${test.label})`,
        scheduled_time: test.time.toISOString(),
        status: 'confirmed',
        event_id: `test_event_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        ...test.fields,
      })
      .select('id, scheduled_time')
      .single();

    if (error) {
      console.error(`❌ Error creando cita "${test.label}":`, error.message);
    } else {
      const timeStr = test.time.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
      console.log(`📅 Cita "${test.label}" creada → ${timeStr} (ID: ${appt.id})`);
    }
  }

  // 4. Disparar el cron manualmente
  console.log('\n🔔 Disparando el cron de recordatorios...\n');

  const baseUrl = 'http://localhost:3000';
  const cronSecret = process.env.CRON_SECRET || '';

  try {
    const res = await fetch(`${baseUrl}/api/cron/send-reminders`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${cronSecret}` },
    });
    const data = await res.json();
    console.log('📊 Resultado del cron:', JSON.stringify(data, null, 2));

    if (data.processedCount > 0) {
      console.log(`\n✅ ¡${data.processedCount} recordatorio(s) procesado(s)!`);
      console.log(`📱 Revisa tu WhatsApp en el número ${TEST_PHONE}`);
    } else {
      console.log('\n⚠️  0 recordatorios procesados. Posibles causas:');
      console.log('   - Las citas aún no caen en ninguna ventana de tiempo');
      console.log('   - Faltan credenciales de WhatsApp en la DB');
    }
  } catch (err) {
    console.error('❌ Error al llamar al cron:', err.message);
  }

  // 5. Limpiar citas de prueba después de 5 segundos
  console.log('\n🧹 Las citas de prueba se limpiarán en 5 segundos...');
  await new Promise(r => setTimeout(r, 5000));

  const { error: deleteErr } = await supabase
    .from('appointments')
    .delete()
    .eq('customer_name', TEST_NAME)
    .eq('tenant_id', config.tenant_id);

  if (deleteErr) {
    console.error('❌ Error limpiando citas:', deleteErr.message);
  } else {
    console.log('🧹 Citas de prueba eliminadas.');
  }

  console.log('\n✅ ¡Prueba completada!');
}

main().catch(console.error);
