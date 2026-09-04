import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.from('platform_settings').select('*');
  console.log("DB DATA:", JSON.stringify(data, null, 2));
  console.log("DB ERROR:", error);
}

main();
