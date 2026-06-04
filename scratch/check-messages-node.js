import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing supabase URL or service role key");
  process.exit(1);
}

async function run() {
  const url = `${supabaseUrl}/rest/v1/messages?select=id,conversation_id,role,content,created_at&order=created_at.desc&limit=10`;
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  if (res.ok) {
    const data = await res.json();
    console.log("Latest messages:");
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.error("Failed:", res.status, await res.text());
  }
}
run();
