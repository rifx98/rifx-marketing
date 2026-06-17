global.WebSocket = class DummyWebSocket {};
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data, error } = await supabase.from('appointments').select('*');
  if (error) {
    console.error('Error fetching appointments:', error.message, error.code);
  } else {
    console.log(`Appointments found (${data.length}):`);
    for (const appt of data) {
      console.log(`- ID: ${appt.id}`);
      console.log(`  Tenant: ${appt.tenant_id}`);
      console.log(`  Name: ${appt.customer_name}`);
      console.log(`  Phone: ${appt.phone_number}`);
      console.log(`  Time: ${appt.scheduled_time}`);
      console.log(`  Status: ${appt.status}`);
      console.log(`  Reminder Sent: ${appt.reminder_sent}`);
    }
  }
}

run().catch(console.error);
