const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Polyfill WebSocket for Node 20 (supabase-js requires it)
global.WebSocket = class DummyWebSocket { close() {} send() {} };

const { createClient } = require('@supabase/supabase-js');

// Supabase direct connection (pooler — transaction mode)
const DB_URL = 'postgresql://postgres.enbezuxcljmdsmtzqktp:RifxMarketing2026!@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

const supabaseUrl = 'https://enbezuxcljmdsmtzqktp.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYmV6dXhjbGptZHNtdHpxa3RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3MzIyMiwiZXhwIjoyMDkzNTQ5MjIyfQ.vHsXhAoRDjo0nJZsonTII9ju7Y4gYa9-tDdgMlc84Ac';
const TENANT_ID = '26db5d82-84e2-4af5-9458-add284631021';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 0 } }
});

async function main() {
  console.log('==========================================');
  console.log(' RIFX — Sales Agent + Pricing Guard Setup');
  console.log('==========================================\n');

  // ---- Método 1: Intentar via supabase-js (verifica si tablas ya existen) ----
  console.log('📋 Verificando estado actual...\n');

  // Check conversations columns
  const { data: convTest, error: convErr } = await supabase
    .from('conversations')
    .select('intent, sales_stage, lead_score')
    .limit(1);

  const salesAgentExists = !convErr;
  console.log(salesAgentExists 
    ? '   ✅ Sales Agent: columnas ya existen en conversations'
    : '   ⏳ Sales Agent: columnas pendientes de crear');

  // Check service_pricing table
  const { error: spErr } = await supabase
    .from('service_pricing')
    .select('id')
    .limit(1);

  const pricingExists = !spErr;
  console.log(pricingExists 
    ? '   ✅ Pricing Guard: tabla service_pricing ya existe'
    : '   ⏳ Pricing Guard: tabla pendiente de crear');

  // ---- Si falta algo, ejecutar SQL via pg ----
  if (!salesAgentExists || !pricingExists) {
    console.log('\n🔌 Conectando a PostgreSQL directamente...');
    
    let pgClient;
    try {
      pgClient = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
      await pgClient.connect();
      console.log('   ✅ Conectado a PostgreSQL\n');
    } catch (connErr) {
      console.error('   ❌ No se pudo conectar a PostgreSQL:', connErr.message);
      console.log('\n   La contraseña de la DB puede haber cambiado.');
      console.log('   ALTERNATIVA: Ejecuta estos SQLs manualmente en Supabase Dashboard → SQL Editor:');
      console.log('   1. supabase-migration-sales-agent.sql');
      console.log('   2. supabase-migration-pricing-guard.sql');
      console.log('   Luego vuelve a correr este script.');
      return;
    }

    try {
      if (!salesAgentExists) {
        console.log('🔄 Ejecutando: Migration Sales Agent...');
        const salesSQL = fs.readFileSync(
          path.join(__dirname, '..', 'supabase-migration-sales-agent.sql'), 'utf8'
        );
        await pgClient.query(salesSQL);
        console.log('   ✅ Sales Agent migration OK');
      }

      if (!pricingExists) {
        console.log('🔄 Ejecutando: Migration Pricing Guard...');
        const pricingSQL = fs.readFileSync(
          path.join(__dirname, '..', 'supabase-migration-pricing-guard.sql'), 'utf8'
        );
        await pgClient.query(pricingSQL);
        console.log('   ✅ Pricing Guard migration OK');
      }
    } catch (sqlErr) {
      console.error('   ❌ Error SQL:', sqlErr.message);
    } finally {
      await pgClient.end();
      console.log('   🔌 Conexión PostgreSQL cerrada');
    }

    // Re-verificar
    console.log('\n📋 Re-verificando...');
    const { error: reConvErr } = await supabase
      .from('conversations')
      .select('intent, sales_stage, lead_score')
      .limit(1);
    console.log(reConvErr 
      ? `   ❌ Conversations: ${reConvErr.message}` 
      : '   ✅ Conversations: columnas OK');

    const { error: reSpErr } = await supabase
      .from('service_pricing')
      .select('id')
      .limit(1);
    console.log(reSpErr 
      ? `   ❌ Service Pricing: ${reSpErr.message}` 
      : '   ✅ Service Pricing: tabla OK');
  }

  // ---- Insertar servicios de prueba ----
  console.log('\n💰 Servicios de prueba...');
  const { data: existing } = await supabase
    .from('service_pricing')
    .select('id, service_name')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true);

  if (existing && existing.length > 0) {
    console.log(`   ⚠️ Ya existen ${existing.length} servicios:`);
    existing.forEach(s => console.log(`      - ${s.service_name}`));
  } else {
    const { data, error } = await supabase.from('service_pricing').insert([
      {
        tenant_id: TENANT_ID,
        service_name: 'Diseño Web Profesional',
        category: 'Diseño',
        description: 'Sitio web responsive moderno con diseño personalizado',
        base_price: 500, currency: 'USD', billing_type: 'one_time',
        included_items: ['Diseño responsive', '5 páginas', 'Hosting 1 año', 'SSL incluido'],
        optional_addons: [{ name: 'SEO básico', price: 100 }, { name: 'E-commerce', price: 200 }],
        is_custom_quote: false,
      },
      {
        tenant_id: TENANT_ID,
        service_name: 'Marketing Digital',
        category: 'Marketing',
        description: 'Gestión integral de redes sociales y publicidad digital',
        currency: 'USD', billing_type: 'monthly',
        included_items: ['Gestión de 3 redes', 'Pauta publicitaria', 'Reportes mensuales'],
        optional_addons: [],
        min_price: 300, max_price: 800,
        is_custom_quote: false,
      },
      {
        tenant_id: TENANT_ID,
        service_name: 'Desarrollo de App Móvil',
        category: 'Desarrollo',
        description: 'Aplicación nativa o híbrida a medida',
        currency: 'USD', billing_type: 'per_project',
        included_items: ['Diseño UI/UX', 'Desarrollo', 'Publicación en stores'],
        optional_addons: [],
        is_custom_quote: true,
      },
    ]).select('id, service_name');

    if (error) {
      console.error(`   ❌ ${error.message}`);
    } else {
      console.log(`   ✅ ${data.length} servicios insertados:`);
      data.forEach(s => console.log(`      - ${s.service_name}`));
    }
  }

  // ---- Verificación final ----
  console.log('\n📊 Estado final:\n');
  const { data: services } = await supabase
    .from('service_pricing')
    .select('service_name, base_price, min_price, max_price, is_custom_quote, billing_type')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('service_name');

  if (services && services.length > 0) {
    for (const s of services) {
      const price = s.is_custom_quote ? '→ Cotización personalizada'
        : s.base_price ? `$${s.base_price} USD (${s.billing_type})`
        : `$${s.min_price}-$${s.max_price} USD/${s.billing_type}`;
      console.log(`   💎 ${s.service_name} — ${price}`);
    }
  }

  console.log('\n==========================================');
  console.log(' ✅ Setup completo. Listo para probar.');
  console.log('==========================================');
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
