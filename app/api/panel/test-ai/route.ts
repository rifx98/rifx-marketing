import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { 
      message, 
      history = [],
      botName = '',
      botRole = '',
      botTone = 'Profesional',
      temperature = 0.7,
      humanHandoff = true,
      profanityFilter = true,
      topicLocks = false,
    } = await req.json();

    const supabase = createSupabaseAdmin();
    
    // Obtener configuración (prompt y key) de la DB
    const { data: config } = await supabase.from('config').select('*').limit(1).single();
    
    const basePrompt = config?.ai_prompt || 'Eres un asesor de ventas amigable y profesional.';
    
    // Decode AI key from JSON-encoded openai_key column
    let groqKey = '';
    try {
      const parsed = JSON.parse(config?.openai_key || '{}');
      groqKey = parsed.groq_key || parsed.openai_key || '';
    } catch {
      groqKey = config?.openai_key || '';
    }
    if (!groqKey) groqKey = process.env.GROQ_API_KEY || '';

    if (!groqKey) {
      return NextResponse.json({ error: 'No se encontró API key de IA. Configúrala en Configuraciones.' }, { status: 500 });
    }

    const groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    // === Build dynamic system prompt from playground settings ===
    const parts: string[] = [];

    // Base configured prompt
    parts.push(basePrompt);

    // Identity & Tone
    if (botName) {
      parts.push(`\nTu nombre es "${botName}". Siempre preséntate con este nombre cuando sea apropiado.`);
    }
    if (botRole) {
      parts.push(`Tu rol es: ${botRole}.`);
    }
    
    // Tone mapping
    const toneInstructions: Record<string, string> = {
      'Profesional': 'Mantén un tono profesional, formal pero cercano. Usa usted cuando sea apropiado.',
      'Casual': 'Usa un tono casual y amigable. Tutea al usuario y usa emojis moderadamente. Sé conversacional.',
      'Técnico': 'Responde con precisión técnica. Usa terminología específica del sector. Sé detallado y exacto.',
      'Amigable': 'Sé muy cálido y empático. Usa emojis, sé entusiasta y haz que el cliente se sienta bienvenido.',
      'Formal': 'Mantén un tono estrictamente formal y corporativo. No uses emojis. Sé conciso y directo.',
    };
    if (botTone && toneInstructions[botTone]) {
      parts.push(`\n[TONO DE COMUNICACIÓN]: ${toneInstructions[botTone]}`);
    }

    // Security & Protections
    if (profanityFilter) {
      parts.push('\n[FILTRO DE LENGUAJE]: Si el usuario usa lenguaje ofensivo o inapropiado, responde con cortesía y redirige la conversación. No repitas ni uses lenguaje ofensivo bajo ninguna circunstancia.');
    }
    if (topicLocks) {
      parts.push('\n[BLOQUEO DE TEMAS]: Solo responde sobre temas relacionados con los productos y servicios de la empresa. Si el usuario pregunta sobre temas no relacionados (política, religión, etc.), redirige amablemente al tema de negocio.');
    }
    if (humanHandoff) {
      parts.push('\n[ESCALAMIENTO HUMANO]: Si el usuario insiste en hablar con un humano real, después de intentar ayudar una vez, indica que un asesor se pondrá en contacto pronto.');
    }

    // Classification instruction
    parts.push('\n\n[INSTRUCCIÓN DE PRUEBA]: Al final de tu respuesta, añade SIEMPRE un bloque JSON exacto con este formato: {"classification": "Interesado" | "Indeciso" | "Curioso", "confidence": number, "next_action": string}. Clasifica según el mensaje del usuario.');

    const systemPrompt = parts.join('\n');

    const chatMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // Use temperature from playground settings
    const safeTemp = Math.max(0, Math.min(2, Number(temperature) || 0.7));

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: chatMessages,
      max_tokens: 500,
      temperature: safeTemp,
    });

    const aiContent = completion.choices[0]?.message?.content || '';
    
    // Intentar extraer el JSON del final
    let classification = { classification: "Indeciso", confidence: 0.5, next_action: "continue_chat" };
    let cleanResponse = aiContent;
    
    const jsonMatch = aiContent.match(/\{[\s\S]*"classification"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        classification = JSON.parse(jsonMatch[0]);
        cleanResponse = aiContent.replace(jsonMatch[0], '').trim();
      } catch (e) {
        console.error("Error parsing AI JSON:", e);
      }
    }

    return NextResponse.json({ 
      response: cleanResponse,
      inference: classification
    });

  } catch (error: any) {
    console.error('Test AI Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
