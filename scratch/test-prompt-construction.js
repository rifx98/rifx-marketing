import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const keySecret = process.env.ENCRYPTION_KEY;
  if (!keySecret) {
    throw new Error('FATAL: ENCRYPTION_KEY environment variable is not set. Add it to .env.local');
  }
  return crypto.createHash('sha256').update(keySecret).digest();
}

function decryptToken(ciphertext, ivHex, tagHex) {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function main() {
  const tenantId = '26db5d82-84e2-4af5-9458-add284631021';
  
  // 1. Fetch config row
  const configRes = await fetch(`${supabaseUrl}/rest/v1/config?tenant_id=eq.${tenantId}&select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  if (!configRes.ok) {
    console.error("Error fetching config:", await configRes.text());
    return;
  }
  const configRows = await configRes.json();
  const config = configRows[0];

  let extConfig = {
    openai_key: '', gemini_key: '', groq_key: '',
    model_selection: 'gpt-4o', confidence_threshold: 0.85,
    dropi_enabled: false, dropi_token: '',
    dropi_default_product_id: '', dropi_default_price: 50,
    dropi_prompt: ''
  };
  try { 
    const p = JSON.parse(config.openai_key || '{}');
    extConfig = { ...extConfig, ...p };
  } catch { 
    extConfig.openai_key = config.openai_key || '';
  }

  let aiPrompt = config.ai_prompt || '';

  // 2. Fetch social accounts
  const saRes = await fetch(`${supabaseUrl}/rest/v1/social_accounts?tenant_id=eq.${tenantId}&platform=eq.google_calendar`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const accounts = await saRes.json();
  const account = accounts[0];
  const isCalendarConnected = !!account;

  console.log(`Calendar Connected: ${isCalendarConnected}`);

  if (isCalendarConnected) {
    // Reemplazar la regla del enlace estático por una regla de agendamiento dinámico interactivo en el prompt base
    const beforeReplaceRule5 = aiPrompt.includes('REGLA DEL ENLACE (CRÍTICO)');
    aiPrompt = aiPrompt.replace(
      /REGLA DEL ENLACE \(CRÍTICO\): NO pongas el enlace de reunión en todos tus mensajes\. Es molesto\. Úsalo ÚNICAMENTE al final de tu mensaje cuando le propongas tener una llamada DESPUÉS de haberle aportado valor, o si el cliente lo pide expresamente\./gi,
      `REGLA DE AGENDAMIENTO (CRÍTICO): NO intentes enviar enlaces de reunión estáticos ni confirmes citas directamente. Debes preguntar la fecha y hora preferida del cliente y usar el sistema de agendamiento dinámico.`
    );
    const afterReplaceRule5 = aiPrompt.includes('REGLA DEL ENLACE (CRÍTICO)');

    const beforeReplaceRule6 = aiPrompt.includes('LIDERAZGO ABSOLUTO');
    aiPrompt = aiPrompt.replace(
      /Después de explicar un beneficio, da un Call To Action \(CTA\) directivo: "Para aterrizar esto a tu negocio, elige un horario aquí 👇: \[PON TU LINK DE REUNIÓN AQUÍ\]" o "Si estás listo para empezar, el pago se hace aquí 💳: \[PON TU LINK DE PAGO AQUÍ\]"\./gi,
      `Después de explicar un beneficio, da un Call To Action (CTA) directivo para agendar una cita o llamada, preguntándole qué día y hora le conviene para verificar disponibilidad en el calendario.`
    );
    const afterReplaceRule6 = aiPrompt.includes('[PON TU LINK DE REUNIÓN AQUÍ]');

    console.log(`Rule 5 before: ${beforeReplaceRule5}, after: ${afterReplaceRule5}`);
    console.log(`Rule 6 before replace of CTA: ${beforeReplaceRule6}, after CTA is in prompt: ${afterReplaceRule6}`);

    const staticLinkPatterns = [
      /\[PON TU LINK DE REUNIÓN AQUÍ\]/gi,
      /\[enlace de reunión\]/gi,
      /\[link de reunión\]/gi,
      /\[enlace de agenda\]/gi,
      /\[link de agenda\]/gi,
      /\[tu link de agenda\]/gi,
      /\[pon tu enlace aquí\]/gi,
      /\[insertar link de calendly\]/gi,
      /\[insertar enlace\]/gi,
    ];
    for (const pattern of staticLinkPatterns) {
      aiPrompt = aiPrompt.replace(pattern, '[pregunta disponibilidad por mensaje]');
    }
  }

  console.log("\n=================== FINAL PROMPT ===================");
  console.log(aiPrompt);
}

main().catch(console.error);
