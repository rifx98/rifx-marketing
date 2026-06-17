global.WebSocket = class DummyWebSocket {};
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const tenantId = '26db5d82-84e2-4af5-9458-add284631021';
const conversationId = '1e8b7e1c-4ff8-4625-bdae-506a55cc0e0e';

async function testCron() {
  try {
    // 1. Delete any existing mock appointments
    console.log('Cleaning up existing test appointments...');
    await supabase
      .from('appointments')
      .delete()
      .eq('phone_number', '593983910712-test');

    // 2. Insert a pending appointment scheduled for 4 hours from now
    const scheduledTime = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    console.log(`Inserting mock pending appointment scheduled for ${scheduledTime}...`);

    const { data: appt, error: insertErr } = await supabase
      .from('appointments')
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        event_id: 'mock-event-id-123',
        customer_name: 'Cliente Prueba Cron',
        phone_number: '593983910712-test',
        scheduled_time: scheduledTime,
        service: 'Asesoría de RIFX',
        status: 'pending',
        reminder_sent: false
      })
      .select()
      .single();

    if (insertErr) {
      throw insertErr;
    }

    console.log('Mock appointment created:', appt.id);

    // 3. Trigger the cron job route locally
    console.log('Triggering send-reminders cron job locally...');
    const res = await fetch('http://localhost:3000/api/cron/send-reminders', {
      method: 'GET',
    });

    console.log(`Cron job responded with Status: ${res.status}`);
    const data = await res.json();
    console.log('Response body:', JSON.stringify(data, null, 2));

    // 4. Verify in DB if reminder_sent is now true
    const { data: updatedAppt } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appt.id)
      .single();

    console.log('Updated appointment in DB:', {
      id: updatedAppt.id,
      status: updatedAppt.status,
      reminder_sent: updatedAppt.reminder_sent
    });

    // Cleanup
    await supabase
      .from('appointments')
      .delete()
      .eq('id', appt.id);
    console.log('Cleanup completed.');

  } catch (err) {
    console.error('Error in test:', err.message);
  }
}

testCron();
