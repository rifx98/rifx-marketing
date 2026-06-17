const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    realtime: {
      transport: { send: () => {}, close: () => {} }
    }
  });
  
  // Try to select a single row (or empty) to see what columns exist
  const { data, error } = await supabase.from('service_pricing').select('*').limit(1);
  if (error) {
    console.error('Error selecting from service_pricing:', error.message);
  } else {
    console.log('Columns of service_pricing:', data.length > 0 ? Object.keys(data[0]) : 'No data returned, let\'s insert a test row to see columns.');
  }

  // Let's query the OpenAPI spec to find the service_pricing schema!
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });
    const schema = await res.json();
    const servicePricingDef = schema.definitions && schema.definitions.service_pricing;
    if (servicePricingDef) {
      console.log('OpenAPI service_pricing properties:', Object.keys(servicePricingDef.properties));
    } else {
      console.log('service_pricing definition not found in OpenAPI spec');
    }
  } catch (err) {
    console.error('Failed to fetch OpenAPI spec:', err.message);
  }
}

run();
