import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    realtime: {
      transport: {
        send: () => {},
        close: () => {}
      }
    }
  });
  console.log('Testing RPC exec_sql...');
  
  const query = `
    CREATE TABLE IF NOT EXISTS templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      preview_image_url TEXT,
      config_json JSONB NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'templates' AND policyname = 'Service role full access on templates'
      ) THEN
        CREATE POLICY "Service role full access on templates" ON templates
          FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END
    $$;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Success:', data);
  }
}

run();
