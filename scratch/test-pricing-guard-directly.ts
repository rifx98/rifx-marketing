// Polyfill WebSocket for Node 20 (supabase-js requires it)
global.WebSocket = class DummyWebSocket { close() {} send() {} } as any;

import { createClient } from '@supabase/supabase-js';
import { loadTenantPricing, buildPricingPrompt, validatePricingInResponse } from '../lib/pricing-guard';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TENANT_ID = '26db5d82-84e2-4af5-9458-add284631021';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log('====================================================');
  console.log('🧪 PRUEBAS DIRECTAS: PRICING GUARD');
  console.log('====================================================\n');

  // 1. Cargar precios oficiales desde Supabase
  console.log('📋 Cargando precios oficiales de la base de datos...');
  const pricingItems = await loadTenantPricing(supabase, TENANT_ID);
  console.log(`   ✅ Cargados ${pricingItems.length} servicios.\n`);

  // 2. Mostrar el Prompt de Precios Generado
  console.log('📝 --- PROMPT DE PRECIOS GENERADO ---');
  const pricingPrompt = buildPricingPrompt(pricingItems);
  console.log(pricingPrompt);
  console.log('-------------------------------------\n');

  // 3. Casos de prueba: Validar respuestas simuladas
  console.log('🔍 --- PRUEBAS DE VALIDACIÓN POST-IA (Con Precios Oficiales) ---');
  
  const testCases = [
    {
      name: 'Respuesta con precio base exacto ($500)',
      text: 'El servicio de Diseño Web Profesional tiene un valor de $500 USD e incluye hosting por 1 año.',
      expectValid: true,
    },
    {
      name: 'Respuesta con precio base exacto en formato alternativo ($500.00)',
      text: 'El costo del diseño web es de $500.00 USD.',
      expectValid: true,
    },
    {
      name: 'Respuesta con precio base exacto sin signo de pesos (500 USD)',
      text: 'El valor es 500 USD por el proyecto.',
      expectValid: true,
    },
    {
      name: 'Respuesta con precio en el rango oficial ($300-$800)',
      text: 'Para el servicio de Marketing Digital, el precio oscila entre $300 y $800 USD/mes, dependiendo de la pauta publicitaria.',
      expectValid: true,
    },
    {
      name: 'Respuesta con precio dentro del rango ($450)',
      text: 'El Marketing Digital te saldría en unos $450 USD al mes.',
      expectValid: true,
    },
    {
      name: 'Respuesta con precio inventado ($250) fuera de lista/rango',
      text: 'El servicio de diseño web profesional cuesta $250 USD por única vez.',
      expectValid: false,
    },
    {
      name: 'Respuesta con precio inventado de otra escala ($1,200)',
      text: 'El desarrollo completo de tu web y redes te costará $1,200 dólares.',
      expectValid: false,
    },
    {
      name: 'Respuesta sin precios numéricos',
      text: 'Claro que sí, con mucho gusto. ¿Me puedes detallar qué tipo de sitio web necesitas y cuántas secciones tendrá para darte una estimación?',
      expectValid: true,
    },
  ];

  for (const tc of testCases) {
    const result = validatePricingInResponse(tc.text, pricingItems);
    const status = result.isValid === tc.expectValid ? '✅ PASÓ' : '❌ FALLÓ';
    console.log(`\n• Caso: ${tc.name}`);
    console.log(`  Texto: "${tc.text}"`);
    console.log(`  Resultado: isValid = ${result.isValid} (${status})`);
    if (!result.isValid) {
      console.log(`  Respuesta reemplazada: "${result.cleanResponse}"`);
    }
  }

  // 4. Casos de prueba: Cuando no hay precios configurados
  console.log('\n🔍 --- PRUEBAS DE VALIDACIÓN (Sin Precios Oficiales Configurados) ---');
  const emptyPricingItems: any[] = [];
  
  const emptyPrompt = buildPricingPrompt(emptyPricingItems);
  console.log('\n📝 --- PROMPT GENERADO (SIN REGISTROS) ---');
  console.log(emptyPrompt);
  console.log('------------------------------------------');

  const emptyTestCases = [
    {
      name: 'Respuesta sin precios',
      text: 'Por el momento no dispongo de tarifas estándar. Cuéntame qué necesitas y lo revisamos.',
      expectValid: true,
    },
    {
      name: 'Respuesta con precio inventado ($350)',
      text: 'El desarrollo de tu proyecto cuesta $350 USD.',
      expectValid: false,
    },
  ];

  for (const tc of emptyTestCases) {
    const result = validatePricingInResponse(tc.text, emptyPricingItems);
    const status = result.isValid === tc.expectValid ? '✅ PASÓ' : '❌ FALLÓ';
    console.log(`\n• Caso: ${tc.name}`);
    console.log(`  Texto: "${tc.text}"`);
    console.log(`  Resultado: isValid = ${result.isValid} (${status})`);
    if (!result.isValid) {
      console.log(`  Respuesta reemplazada: "${result.cleanResponse}"`);
    }
  }

  console.log('\n====================================================');
  console.log('🏁 Todas las pruebas directas completadas.');
  console.log('====================================================');
}

main().catch(console.error);
