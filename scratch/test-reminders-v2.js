global.WebSocket = class DummyWebSocket {};
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const tenantId = '26db5d82-84e2-4af5-9458-add284631021';
const conversationId = '1e8b7e1c-4ff8-4625-bdae-506a55cc0e0e';
const testPhone = '593983910712'; // Real Bryan test phone to send WA

async function runTest() {
  try {
    console.log('🧹 Limpiando citas de prueba anteriores...');
    await supabase
      .from('appointments')
      .delete()
      .eq('phone_number', '593983910712-test');

    const now = new Date();

    // 1. Cita de 24h (24h en el futuro)
    const time24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    // 2. Cita de 2h (2h en el futuro)
    const time2h = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    // 3. Cita de 30m (30m en el futuro, confirmada)
    const time30m = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    // 4. Cita pasada confirmed (45m en el pasado) -> Debe ir a pending_completion
    const timePastConfirmed = new Date(now.getTime() - 45 * 60 * 1000).toISOString();
    // 5. Cita pasada pending (75m en el pasado) -> Debe ir a no_show
    const timePastPending = new Date(now.getTime() - 75 * 60 * 1000).toISOString();

    console.log('📅 Creando citas de prueba...');

    const { data: appt24h } = await supabase.from('appointments').insert({
      tenant_id: tenantId, conversation_id: conversationId, event_id: 'test-event-24h',
      customer_name: 'Cliente Test 24h', phone_number: '593983910712-test',
      scheduled_time: time24h, service: 'Asesoría 24h', status: 'pending'
    }).select().single();

    const { data: appt2h } = await supabase.from('appointments').insert({
      tenant_id: tenantId, conversation_id: conversationId, event_id: 'test-event-2h',
      customer_name: 'Cliente Test 2h', phone_number: '593983910712-test',
      scheduled_time: time2h, service: 'Asesoría 2h', status: 'pending'
    }).select().single();

    const { data: appt30m } = await supabase.from('appointments').insert({
      tenant_id: tenantId, conversation_id: conversationId, event_id: 'test-event-30m',
      customer_name: 'Cliente Test 30m', phone_number: '593983910712-test',
      scheduled_time: time30m, service: 'Asesoría 30m', status: 'confirmed'
    }).select().single();

    const { data: apptPastConf } = await supabase.from('appointments').insert({
      tenant_id: tenantId, conversation_id: conversationId, event_id: 'test-event-past-conf',
      customer_name: 'Cliente Test Past Conf', phone_number: '593983910712-test',
      scheduled_time: timePastConfirmed, service: 'Asesoría Pasada Conf', status: 'confirmed'
    }).select().single();

    const { data: apptPastPend } = await supabase.from('appointments').insert({
      tenant_id: tenantId, conversation_id: conversationId, event_id: 'test-event-past-pend',
      customer_name: 'Cliente Test Past Pend', phone_number: '593983910712-test',
      scheduled_time: timePastPending, service: 'Asesoría Pasada Pend', status: 'pending'
    }).select().single();

    console.log('✅ Citas creadas en DB.');

    // --- EJECUTAR SIMULACIÓN DE CRON ---
    console.log('⚙️ Iniciando simulación del cron v2...');

    // Rango de búsqueda: desde hace 3 horas hasta dentro de 26 horas
    const rangeStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    const rangeEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000).toISOString();

    const { data: appts } = await supabase
      .from('appointments')
      .select('*')
      .in('status', ['pending', 'confirmed', 'awaiting_reschedule', 'rescheduled', 'pending_completion'])
      .gte('scheduled_time', rangeStart)
      .lte('scheduled_time', rangeEnd);

    console.log(`📊 Citas en rango encontradas: ${appts?.length || 0}`);

    for (const appt of (appts || [])) {
      if (!appt.phone_number.includes('-test')) continue; // Solo procesar nuestras citas de prueba

      const apptTime = new Date(appt.scheduled_time).getTime();
      const nowTime = now.getTime();
      const diffMs = apptTime - nowTime;
      const diffHrs = diffMs / (1000 * 60 * 60);

      // A. Ciclo de vida pasado
      if (diffMs < 0) {
        const pastMinutes = Math.abs(diffMs) / (1000 * 60);
        if (pastMinutes > 30 && (appt.status === 'confirmed' || appt.status === 'rescheduled')) {
          console.log(`🔄 [Transición] Cita ${appt.id} (${appt.customer_name}) -> pending_completion`);
          await supabase.from('appointments').update({ status: 'pending_completion', updated_at: new Date().toISOString() }).eq('id', appt.id);
        }
        if (pastMinutes > 60 && (appt.status === 'pending' || appt.status === 'awaiting_reschedule')) {
          console.log(`🔄 [Transición] Cita ${appt.id} (${appt.customer_name}) -> no_show`);
          await supabase.from('appointments').update({ status: 'no_show', updated_at: new Date().toISOString() }).eq('id', appt.id);
        }
        continue;
      }

      // B. Recordatorios
      let type = null;
      let updateField = '';
      if (diffHrs > 23.0 && diffHrs <= 25.0 && !appt.reminder_24h_sent) {
        type = '24h';
        updateField = 'reminder_24h_sent';
      } else if (diffHrs > 1.5 && diffHrs <= 2.5 && !appt.reminder_2h_sent) {
        type = '2h';
        updateField = 'reminder_2h_sent';
      } else if (diffHrs > 0.25 && diffHrs <= 0.75 && !appt.reminder_30m_sent) {
        type = '30m';
        updateField = 'reminder_30m_sent';
      }

      if (!type) {
        console.log(`ℹ️ Cita ${appt.id} (${appt.customer_name}) en ${diffHrs.toFixed(2)}h no requiere acción de recordatorio.`);
        continue;
      }

      console.log(`💬 Recordatorio ${type} listo para enviar a ${appt.customer_name}`);
      
      // Simular actualización del recordatorio en DB
      const updateData = { reminder_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      updateData[updateField] = true;
      await supabase.from('appointments').update(updateData).eq('id', appt.id);
      console.log(`✅ Recordatorio ${type} marcado en DB para ${appt.customer_name}`);
    }

    // --- VERIFICAR RESULTADOS ---
    console.log('🔍 Verificando estados actualizados en Supabase...');
    const { data: results } = await supabase
      .from('appointments')
      .select('*')
      .eq('phone_number', '593983910712-test');

    for (const r of results) {
      console.log(`- Cita: ${r.customer_name}`);
      console.log(`  Estado: ${r.status}`);
      console.log(`  24h Sent: ${r.reminder_24h_sent}`);
      console.log(`  2h Sent: ${r.reminder_2h_sent}`);
      console.log(`  30m Sent: ${r.reminder_30m_sent}`);
      console.log(`  Sent At: ${r.reminder_sent_at}`);
    }

    // --- LIMPIEZA ---
    console.log('🧹 Limpiando citas de prueba...');
    await supabase
      .from('appointments')
      .delete()
      .eq('phone_number', '593983910712-test');
    console.log('🎉 Simulación completada con éxito!');

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

runTest();
