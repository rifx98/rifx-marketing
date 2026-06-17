import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import crypto from 'crypto';
import OpenAI from 'openai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const keySecret = process.env.ENCRYPTION_KEY;
  if (!keySecret) {
    throw new Error('FATAL: ENCRYPTION_KEY environment variable is not set.');
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
  const convId = '1e8b7e1c-4ff8-4625-bdae-506a55cc0e0e';

  // 1. Fetch config
  const configRes = await fetch(`${supabaseUrl}/rest/v1/config?tenant_id=eq.${tenantId}&select=*`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const config = (await configRes.json())[0];

  let extConfig = {
    openai_key: '', gemini_key: '', groq_key: '',
    model_selection: 'gpt-4o', confidence_threshold: 0.85
  };
  try { 
    const p = JSON.parse(config.openai_key || '{}');
    extConfig = { ...extConfig, ...p };
  } catch { 
    extConfig.openai_key = config.openai_key || '';
  }

  let aiPrompt = config.ai_prompt || '';

  // 2. Add calendar instructions
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const todayName = dayNames[today.getDay()];

  // Perform replacements on aiPrompt
  aiPrompt = aiPrompt.replace(
    /REGLA DEL ENLACE \(CRÍTICO\): NO pongas el enlace de reunión en todos tus mensajes\. Es molesto\. Úsalo ÚNICAMENTE al final de tu mensaje cuando le propongas tener una llamada DESPUÉS de haberle aportado valor, o si el cliente lo pide expresamente\./gi,
    `REGLA DE AGENDAMIENTO (CRÍTICO): NO intentes enviar enlaces de reunión estáticos ni confirmes citas directamente. Debes preguntar la fecha y hora preferida del cliente y usar el sistema de agendamiento dinámico.`
  );

  aiPrompt = aiPrompt.replace(
    /Después de explicar un beneficio, da un Call To Action \(CTA\) directivo: "Para aterrizar esto a tu negocio, elige un horario aquí 👇: \[PON TU LINK DE REUNIÓN AQUÍ\]" o "Si estás listo para empezar, el pago se hace aquí 💳: \[PON TU LINK DE PAGO AQUÍ\]"\./gi,
    `Después de explicar un beneficio, da un Call To Action (CTA) directivo para agendar una cita o llamada, preguntándole qué día y hora le conviene para verificar disponibilidad en el calendario.`
  );

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

  aiPrompt += `\n\n[SISTEMA DE AGENDAMIENTO DE CITAS — GOOGLE CALENDAR CONECTADO]:
Tienes acceso al calendario del negocio para agendar reuniones y citas con los clientes.
Hoy es ${todayName} ${todayStr}.

Cuando un cliente quiera agendar una cita, reunión o consulta:
1. Pregúntale qué día y hora le conviene. Los horarios de atención son de Lunes a Viernes, de 9:00 AM a 6:00 PM.
2. Cuando el cliente proponga una fecha, usa el siguiente tag para verificar disponibilidad:
   [VERIFICAR_DISPONIBILIDAD:YYYY-MM-DD]
   El sistema te devolverá los horarios disponibles para ese día.
3. Muéstrale al cliente las opciones de horario disponibles.
4. Cuando el cliente confirme un horario específico (ej. "el viernes a las 10:00 AM" o "mañana a las 4:00 PM"), debes usar este tag exacto para crear la cita:
   [AGENDAR_CITA:nombre_cliente:telefono:YYYY-MM-DD:HH:MM:servicio_o_motivo]
   Ejemplo: [AGENDAR_CITA:Juan Pérez:593984111222:2026-06-12:10:00:Consulta de Marketing Digital]
   NUNCA confirmes la cita tú mismo en tu propia respuesta. El sistema procesará el agendamiento y te dará la confirmación automáticamente.
5. Si el cliente pregunta por disponibilidad sin dar una fecha concreta, sugiérele los próximos días hábiles.

IMPORTANTE:
- Solo usa estos tags cuando el cliente EXPLÍCITAMENTE quiera agendar una cita.
- No inventes fechas ni horarios. Siempre consulta primero con [VERIFICAR_DISPONIBILIDAD].
- Las citas duran 1 hora por defecto.
- NUNCA envíes un enlace de reunión estático. Siempre usa los tags [VERIFICAR_DISPONIBILIDAD] and [AGENDAR_CITA] para gestionar citas de forma dinámica.
- Para calcular fechas relativas (ej. "mañana", "el jueves", "este viernes"), básate en que hoy es ${todayName} ${todayStr}. Por ejemplo, si hoy es Lunes 2026-06-08, "este viernes" es 2026-06-12. Calcula siempre la fecha exacta en formato YYYY-MM-DD.`;

  // 3. Load history
  const resHist = await fetch(`${supabaseUrl}/rest/v1/messages?select=role,content&conversation_id=eq.${convId}&order=created_at.desc&limit=15`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const rawHistory = await resHist.json();

  const errorPatterns = [
    'Lo siento, no pude procesar',
    'Disculpa, estoy procesando mucha información',
    'Estamos experimentando dificultades técnicas',
  ];
  const cleanHistory = (rawHistory || [])
    .reverse()
    .filter((m) => 
      !errorPatterns.some(p => m.content.includes(p)) &&
      m.content !== '__SYSTEM_PAUSE__' && 
      m.content !== '__SYSTEM_RESUME__' &&
      m.content !== '__HUMAN_REQUEST__' &&
      m.content !== '__HUMAN_ASK__'
    );

  const history = cleanHistory.slice(-10);

  const chatMessages = [
    { role: 'system', content: aiPrompt },
    ...history.map((m) => {
      let content = m.content;
      for (const pattern of staticLinkPatterns) {
        content = content.replace(pattern, '[pregunta disponibilidad por mensaje]');
      }
      return { role: m.role, content };
    }),
  ];

  console.log("=== CHAT MESSAGES TO SEND ===");
  console.log(JSON.stringify(chatMessages, null, 2));

  // 4. Call Groq
  const apiKey = extConfig.groq_key;
  const selectedModel = extConfig.model_selection || 'llama-3.3-70b-versatile';
  console.log(`\nCalling Groq with model: ${selectedModel}`);

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });
  
  const completion = await client.chat.completions.create({
    model: selectedModel,
    messages: chatMessages,
    max_tokens: 500,
    temperature: 0.7,
  });

  const aiResponse = completion.choices[0]?.message?.content || '';
  console.log("\n=== AI RESPONSE ===");
  console.log(aiResponse);
}

main().catch(console.error);
