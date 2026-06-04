const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing supabase URL or service role key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLatestMessages() {
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, conversation_id, role, content, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error("Error fetching messages:", error);
    } else {
      console.log("Latest 10 messages in database:");
      console.log(JSON.stringify(messages, null, 2));
    }
  } catch (e) {
    console.error("Exception occurred:", e);
  }
}

checkLatestMessages();
