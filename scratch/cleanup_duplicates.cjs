require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: { transport: require('ws') }
});

async function runCleanup() {
  console.log("Fetching all appointments...");
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching appointments:", error);
    return;
  }

  // Group by phone_number
  const groups = {};
  for (const appt of appointments) {
    if (!groups[appt.phone_number]) {
      groups[appt.phone_number] = [];
    }
    groups[appt.phone_number].push(appt);
  }

  // Keep the most recent (which is the first one due to order), delete others
  let deletedCount = 0;
  for (const phone in groups) {
    const list = groups[phone];
    if (list.length > 1) {
      console.log(`Phone ${phone} has ${list.length} appointments. Keeping ID ${list[0].id}, deleting the rest.`);
      for (let i = 1; i < list.length; i++) {
        const apptToDelete = list[i];
        const { error: delErr } = await supabase
          .from('appointments')
          .delete()
          .eq('id', apptToDelete.id);
        
        if (delErr) {
          console.error(`Failed to delete ${apptToDelete.id}:`, delErr);
        } else {
          deletedCount++;
          console.log(`Deleted duplicate ID: ${apptToDelete.id}`);
        }
      }
    }
  }

  console.log(`Cleanup complete. Deleted ${deletedCount} duplicate appointments.`);
  process.exit(0);
}

runCleanup();
