global.WebSocket = class DummyWebSocket {};
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const tenantId = '26db5d82-84e2-4af5-9458-add284631021';
const conversationId = '1e8b7e1c-4ff8-4625-bdae-506a55cc0e0e';

async function runTest() {
  try {
    // 1. Limpiar citas de prueba viejas
    console.log('🧹 Limpiando citas de prueba anteriores...');
    await supabase
      .from('appointments')
      .delete()
      .eq('phone_number', '593983910712-test');

    // 2. Insertar una cita de prueba que venza en 3 horas (dentro del rango de 18 horas del cron)
    const scheduledTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    console.log(`📅 Creando cita de prueba para: ${scheduledTime}`);
    
    const { data: appt, error: insertErr } = await supabase
      .from('appointments')
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        event_id: 'mock-cron-test-event-id',
        customer_name: 'Cliente Prueba Cron Local',
        phone_number: '593983910712-test', // Usamos un sufijo -test o el número real si queremos que llegue.
        // Espera, si usamos un número de teléfono real (ej. '593983910712' de Bryan),
        // ¿le llegará el recordatorio? ¡Sí! Así podemos comprobar que WhatsApp llega!
        // Pero para no molestar si no es necesario, podemos probar con un número real o ficticio.
        // Pongamos el número real de prueba de Bryan '593983910712' para verificar el envío de WhatsApp real.
        phone_number: '593983910712',
        scheduled_time: scheduledTime,
        service: 'Asesoría VIP de RIFX',
        status: 'pending',
        reminder_sent: false
      })
      .select()
      .single();

    if (insertErr) throw insertErr;
    console.log(`✅ Cita de prueba creada con ID: ${appt.id}`);

    // 3. Ejecutar la lógica exacta del cron handler
    console.log('⚙️ Iniciando ejecución simulada del cron...');
    
    const now = new Date();
    const rangeStart = now.toISOString();
    const rangeEnd = new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString();
    
    console.log(`🔍 Buscando citas en rango: [${rangeStart}] a [${rangeEnd}]`);

    const { data: appts, error: apptsError } = await supabase
      .from('appointments')
      .select('*')
      .eq('status', 'pending')
      .eq('reminder_sent', false)
      .gte('scheduled_time', rangeStart)
      .lte('scheduled_time', rangeEnd);

    if (apptsError) throw apptsError;

    console.log(`📊 Citas encontradas en rango: ${appts.length}`);
    const testAppt = appts.find(a => a.id === appt.id);
    if (!testAppt) {
      console.error('❌ La cita de prueba no fue seleccionada por la consulta del cron!');
      return;
    }
    console.log('🎯 Cita de prueba seleccionada exitosamente para enviar recordatorio!');

    // Obtener configuración del tenant
    const { data: tenantConfig, error: configErr } = await supabase
      .from('config')
      .select('whatsapp_token, whatsapp_phone_id')
      .eq('tenant_id', testAppt.tenant_id)
      .limit(1)
      .maybeSingle();

    if (configErr || !tenantConfig) {
      throw new Error(`No se encontró configuración para el tenant: ${configErr?.message || 'Config vacía'}`);
    }

    let token = tenantConfig.whatsapp_token || process.env.WHATSAPP_TOKEN;
    let phoneId = tenantConfig.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
    
    if (token && token.length < 20) token = process.env.WHATSAPP_TOKEN;
    if (phoneId && phoneId.length < 5) phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneId) {
      throw new Error('Faltan credenciales de WhatsApp (token o phone_id)');
    }

    const apptDate = new Date(testAppt.scheduled_time);
    const formatOptions = {
      timeZone: 'America/Guayaquil',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    const formattedTime = new Intl.DateTimeFormat('es-EC', formatOptions).format(apptDate);
    const reminderText = `Hola *${testAppt.customer_name}*, te escribimos de RIFX Marketing para recordarte tu cita de *${testAppt.service}* programada para hoy a las *${formattedTime}*. ¿Confirmas tu asistencia? (Por favor responde con *Sí* o *No*) 😊`;

    console.log(`💬 Enviando mensaje: "${reminderText}" a ${testAppt.phone_number}...`);

    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: testAppt.phone_number,
        type: 'text',
        text: { body: reminderText },
      }),
    });

    const result = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(result, null, 2));

    if (!response.ok) {
      throw new Error(`Meta API error: ${JSON.stringify(result)}`);
    }

    console.log('✅ WhatsApp enviado con éxito.');

    // Actualizar DB
    const { error: updateErr } = await supabase
      .from('appointments')
      .update({ reminder_sent: true, updated_at: new Date().toISOString() })
      .eq('id', testAppt.id);

    if (updateErr) throw updateErr;
    console.log('✅ Estado en DB actualizado a reminder_sent = true.');

    // Insertar log de chat
    const { error: msgErr } = await supabase.from('messages').insert({
      conversation_id: testAppt.conversation_id,
      role: 'assistant',
      content: `🤖 [Recordatorio Automático]: ${reminderText}`,
    });

    if (msgErr) throw msgErr;
    console.log('✅ Mensaje guardado en el historial de chat.');

    // 4. Limpieza final de la cita de prueba
    console.log('🧹 Eliminando cita de prueba...');
    await supabase
      .from('appointments')
      .delete()
      .eq('id', testAppt.id);
    console.log('🎉 ¡Prueba de lógica del cron completada de forma exitosa!');

  } catch (err) {
    console.error('❌ Error durante la prueba:', err);
  }
}

runTest();
