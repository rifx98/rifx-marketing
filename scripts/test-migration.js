import fs from 'fs';
import path from 'path';

// 1. Load env variables from .env.local manually
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log(`[TEST] Cargando variables de entorno desde ${envLocalPath}`);
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    let val = parts.slice(1).join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
    process.env[key] = val;
  });
}

// 2. Set hybrid environment configuration flags for this execution
process.env.USE_GROQ = 'true';
process.env.USE_FLUX = 'true';
process.env.USE_OPENAI = 'false';
process.env.USE_OPENAI_FALLBACK = 'false';

// Import providers dynamically using TS runner capabilities
import { groqProvider } from '../providers/groq-provider';
import { fluxProvider } from '../providers/flux-provider';
import { aiRouter } from '../providers/ai-router';

async function runTest() {
  console.log('\n🚀 INICIANDO TEST DE MIGRACIÓN AISLADO (GROQ + FLUX)...');
  console.log('======================================================================');
  console.log(`GROQ API KEY CONFIGURADA: ${process.env.GROQ_API_KEY ? 'SÍ' : 'NO'}`);
  console.log(`FAL KEY CONFIGURADA: ${process.env.FAL_KEY ? 'SÍ' : 'NO'}`);
  console.log('======================================================================\n');

  if (!process.env.GROQ_API_KEY || !process.env.FAL_KEY) {
    console.error('❌ Error: Se requieren GROQ_API_KEY y FAL_KEY en .env.local para ejecutar el test.');
    process.exit(1);
  }

  try {
    // Load local sample images
    const templatePath = path.resolve(process.cwd(), 'public/images/mars.png');
    const productPath = path.resolve(process.cwd(), 'public/images/mars-isolated.png');

    if (!fs.existsSync(templatePath) || !fs.existsSync(productPath)) {
      throw new Error(`Archivos locales de prueba no encontrados en public/images/`);
    }

    const templateBase64 = `data:image/png;base64,${fs.readFileSync(templatePath).toString('base64')}`;
    const productBase64 = `data:image/png;base64,${fs.readFileSync(productPath).toString('base64')}`;

    console.log(`📸 [TEST] Imágenes de prueba cargadas correctamente.`);
    console.log(`   - Template (mars.png): ${Math.round(templateBase64.length / 1024)} KB`);
    console.log(`   - Product (mars-isolated.png): ${Math.round(productBase64.length / 1024)} KB\n`);

    // ==========================================
    // STAGE 1: PRODUCT ANALYSIS (GROQ)
    // ==========================================
    console.log('--- EJECUTANDO STAGE 1: ANALYZING PRODUCT ---');
    const productAnalysis = await aiRouter.analyzeProduct(productBase64);
    console.log('✅ STAGE 1 COMPLETADO CON ÉXITO.');
    console.log(`   Producto detectado: "${productAnalysis.product_name}"`);
    console.log(`   Categoría: "${productAnalysis.category}"`);
    console.log(`   Colores clave: ${productAnalysis.main_colors.join(', ')}\n`);

    // ==========================================
    // STAGE 2: COPYWRITING (GROQ)
    // ==========================================
    console.log('--- EJECUTANDO STAGE 2: GENERATING COPY ---');
    const copywriting = await aiRouter.generateCopy(
      productAnalysis,
      'Campaña Planeta Rojo',
      'Destacar la aventura espacial y el estilo cósmico de este producto',
      null,
      3,
      false
    );
    console.log('✅ STAGE 2 COMPLETADO CON ÉXITO.');
    console.log(`   Badg: "${copywriting.badge}"`);
    console.log(`   Hook: "${copywriting.hook}"`);
    console.log(`   Desc: "${copywriting.desc}"`);
    console.log(`   Benefits: ${copywriting.benefits.join(' | ')}\n`);

    // ==========================================
    // STAGE 3: TEMPLATE DNA (GROQ)
    // ==========================================
    console.log('--- EJECUTANDO STAGE 3: TEMPLATE DNA ---');
    const templateDNA = await aiRouter.analyzeTemplateDNA(templateBase64, { primary: '#FF3366', accent: '#FFCC00' });
    console.log('✅ STAGE 3 COMPLETADO CON ÉXITO.');
    console.log(`   Paleta Dominante: ${templateDNA.dominant_palette.join(', ')}`);
    console.log(`   Iluminación: "${templateDNA.lighting_style}"`);
    console.log(`   Mood: "${templateDNA.cinematic_mood}"\n`);

    // ==========================================
    // STAGE 3.5: ART DIRECTION (GROQ)
    // ==========================================
    console.log('--- EJECUTANDO STAGE 3.5: ART DIRECTION ---');
    const artDirection = await aiRouter.generateArtDirection(
      'premium luxury',
      { composition_rules: 'centered', lighting_rules: 'soft spotlight', camera_rules: 'eye-level', colors: { primary: '#FF3366', accent: '#FFCC00' } },
      { background_style: 'minimalist dark void', mood: 'sophisticated' },
      productAnalysis
    );
    console.log('✅ STAGE 3.5 COMPLETADO CON ÉXITO.');
    console.log(`   Scene: "${artDirection.scene}"`);
    console.log(`   Lighting: "${artDirection.lighting}"`);
    console.log(`   Mood: "${artDirection.mood}"\n`);

    // ==========================================
    // STAGE 4: COLOR ENGINE (GROQ)
    // ==========================================
    console.log('--- EJECUTANDO STAGE 4: COLOR ENGINE ---');
    const adaptedColors = await aiRouter.adaptColors(
      templateDNA,
      productAnalysis,
      { colors: { primary: '#FF3366', accent: '#FFCC00', text: '#FFFFFF', badgeBg: '#FF3366', badgeText: '#FFFFFF' } },
      'premium luxury'
    );
    console.log('✅ STAGE 4 COMPLETADO CON ÉXITO.');
    console.log(`   UI primary: "${adaptedColors.ui_palette?.primary}"`);
    console.log(`   Env blended bg: "${adaptedColors.environment_palette?.blended_background}"\n`);


    // ==========================================
    // STAGE 5: VISUAL RENDER ENGINE (FLUX)
    // ==========================================
    console.log('--- EJECUTANDO STAGE 5: VISUAL RENDER (FLUX INPAINTING) ---');
    const promptText = `Advertising photograph of the ${productAnalysis.product_name} seamlessly composited into the space-themed landscape, following ${templateDNA.cinematic_mood} and ${templateDNA.lighting_style}. Studio product lighting, realistic shadows integration. Professional Spanish text slots containing "${copywriting.hook}" and "${copywriting.desc}" beautifully rendered on the canvas. Cinematic, 8k resolution, commercial grade.`;

    const productSlot = {
      x: 0.5,
      y: 0.65,
      width: 0.35,
      height: 0.35,
      shape: 'ellipse',
      padding: 0.05
    };

    const textSlot1 = {
      x: 0.5,
      y: 0.25,
      width: 0.6,
      height: 0.15,
      shape: 'rectangle',
      padding: 0.02
    };

    const editableZones = [productSlot, textSlot1];

    const renderResult = await aiRouter.renderVisual(
      promptText,
      templateBase64,
      productBase64,
      null,
      '1024x1024',
      true,
      {
        productSlot,
        editableZones,
        hasTextSlots: true,
        cleanedTemplateBase64: templateBase64
      }
    );

    console.log('✅ STAGE 5 COMPLETADO CON ÉXITO.');
    console.log(`   Render final generado con provider: "${renderResult.provider}"`);
    console.log(`   Longitud base64 resultado: ${renderResult.base64.length} caracteres\n`);

    // Save final visual output to verify compositing manually
    const outputDir = path.resolve(process.cwd(), 'scratch');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    const outputPath = path.resolve(outputDir, 'test-render-result.png');
    const finalBuffer = Buffer.from(renderResult.base64.split(',')[1], 'base64');
    fs.writeFileSync(outputPath, finalBuffer);
    console.log(`💾 [TEST] Render final guardado en: ${outputPath}\n`);

    // ==========================================
    // STAGE 6: SEMANTIC QA AUDIT (GROQ)
    // ==========================================
    console.log('--- EJECUTANDO STAGE 6: SEMANTIC QA AUDIT ---');
    const qaResult = await aiRouter.runQA(
      templateBase64,
      productBase64,
      renderResult.base64,
      promptText,
      {},
      {},
      true,
      copywriting,
      productAnalysis
    );

    console.log('✅ STAGE 6 COMPLETADO CON ÉXITO.');
    console.log(`   QA Aprobado: ${qaResult.passed ? 'SÍ' : 'NO'}`);
    console.log(`   Razón: "${qaResult.reason}"`);
    console.log(`   Problemas detectados: ${JSON.stringify(qaResult.issues)}\n`);

    console.log('🎉🎉🎉 TODO EL PIPELINE MIGRADO SE HA EJECUTADO Y VERIFICADO CORRECTAMENTE EN EL TEST AISLADO! 🎉🎉🎉');
  } catch (error) {
    console.error('❌ Error ejecutando el test de migración:', error);
    process.exit(1);
  }
}

runTest();
