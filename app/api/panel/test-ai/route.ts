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
      model = '',
    } = await req.json();

    const supabase = createSupabaseAdmin();
    
    // Resolve tenantId from Authorization header
    const authHeader = req.headers.get('authorization');
    let tenantId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        tenantId = payload.tenant_id || null;
      } catch (err) {
        console.error('Error parsing token in test-ai:', err);
      }
    }

    // Obtener configuración (prompt y key) de la DB
    let config: any = null;
    if (tenantId) {
      const { data: tenantConfig } = await supabase
        .from('config')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(1)
        .single();
      config = tenantConfig;
    }
    
    if (!config) {
      const { data: anyConfig } = await supabase.from('config').select('*').limit(1).single();
      config = anyConfig;
    }
    
    const basePrompt = config?.ai_prompt || 'Eres un asesor de ventas amigable y profesional.';
    
    // Decode AI key from JSON-encoded openai_key column
    let extConfig = { openai_key: '', gemini_key: '', groq_key: '', anthropic_key: '', model_selection: 'gpt-4o' };
    try {
      const parsed = JSON.parse(config?.openai_key || '{}');
      extConfig = { ...extConfig, ...parsed };
    } catch {
      extConfig.openai_key = config?.openai_key || '';
    }

    // Resolve model to use
    let selectedModel = model;
    if (!selectedModel) {
      selectedModel = extConfig.model_selection || 'gpt-4o';
    }

    let targetModel = selectedModel;
    if (targetModel === 'llama-3.3-70b') {
      targetModel = 'llama-3.3-70b-versatile';
    } else if (targetModel === 'mixtral-8x7b') {
      targetModel = 'mixtral-8x7b-32768';
    } else if (targetModel === 'llama-3.1-405b') {
      targetModel = 'llama-3.1-405b-reasoning';
    }

    const isGroq = targetModel.startsWith('llama') || targetModel.startsWith('mixtral');
    const isGemini = targetModel.startsWith('gemini');
    const isAnthropic = targetModel.startsWith('claude');
    const isOpenAI = !isGroq && !isGemini && !isAnthropic;

    // Resolve API key based on provider
    let apiKey = '';
    if (isGroq) apiKey = extConfig.groq_key || process.env.GROQ_API_KEY || '';
    else if (isGemini) apiKey = extConfig.gemini_key || process.env.GEMINI_API_KEY || '';
    else if (isAnthropic) apiKey = extConfig.anthropic_key || process.env.ANTHROPIC_API_KEY || '';
    else apiKey = extConfig.openai_key || process.env.OPENAI_API_KEY || '';

    if (!apiKey) {
      if (isGroq) apiKey = process.env.GROQ_API_KEY || '';
      else if (isGemini) apiKey = process.env.GEMINI_API_KEY || '';
      else if (isAnthropic) apiKey = process.env.ANTHROPIC_API_KEY || '';
      else apiKey = process.env.OPENAI_API_KEY || '';
    }

    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json({ error: `No se encontró API key de IA para el proveedor de ${selectedModel}. Configúrala en Configuraciones.` }, { status: 500 });
    }

    // === Build dynamic system prompt from playground settings ===
    const parts: string[] = [];

    // Base configured prompt
    parts.push(basePrompt);

    // Cargar Base de Conocimiento del tenant
    if (tenantId) {
      try {
        const kbEntries = await getKBIndex(supabase, tenantId);
        const activeEntries = kbEntries.filter((e: any) => e.active && e.content);
        
        if (activeEntries.length > 0) {
          let kbContext = '\n\n[BASE DE CONOCIMIENTO — Usa esta información para responder preguntas del cliente]:\n';
          let totalChars = 0;
          const maxKbChars = 30000;
          
          for (const entry of activeEntries) {
            if (totalChars + entry.content.length > maxKbChars) {
              const remaining = maxKbChars - totalChars;
              if (remaining > 200) {
                kbContext += `\n--- ${entry.file_name} ---\n${entry.content.substring(0, remaining)}...\n`;
              }
              break;
            }
            kbContext += `\n--- ${entry.file_name} ---\n${entry.content}\n`;
            totalChars += entry.content.length;
          }
          
          parts.push(kbContext);
          console.log(`📚 KB (Test AI): ${activeEntries.length} archivos activos inyectados (${totalChars} chars) para tenant ${tenantId}`);
        }
      } catch (kbErr) {
        console.log(`📚 KB (Test AI): Sin base de conocimiento para tenant ${tenantId} (${kbErr})`);
      }
    }

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

    let aiContent = '';
    if (isGemini) {
      // Google Gemini via REST API
      const geminiMessages = chatMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.role === 'system' ? `[System Instructions]: ${m.content}` : m.content }],
      }));
      const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: geminiMessages, generationConfig: { maxOutputTokens: 500, temperature: safeTemp } }),
      });
      const gemData = await gemRes.json();
      aiContent = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (isAnthropic) {
      // Anthropic Claude via REST API
      const anthRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: targetModel === 'claude-sonnet-4' ? 'claude-3-5-sonnet-20241022' : 'claude-3-5-haiku-20241022',
          max_tokens: 500,
          temperature: safeTemp,
          system: systemPrompt,
          messages: history.map((h: any) => ({
            role: h.role === 'assistant' ? 'assistant' : 'user',
            content: h.content
          })).concat([{ role: 'user', content: message }])
        })
      });
      const anthData = await anthRes.json();
      aiContent = anthData?.content?.[0]?.text || '';
    } else {
      // OpenAI / Groq (both use OpenAI SDK)
      const client = new OpenAI({
        apiKey,
        baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined,
      });
      const completion = await client.chat.completions.create({
        model: targetModel,
        messages: chatMessages,
        max_tokens: 500,
        temperature: safeTemp,
      });
      aiContent = completion.choices[0]?.message?.content || '';
    }
    
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

// Helper: Get KB index from storage
async function getKBIndex(supabase: any, tenantId: string) {
  const path = `${tenantId}/index.json`;
  const { data, error } = await supabase.storage
    .from('knowledge-base')
    .download(path);
  
  if (error || !data) return [];
  
  try {
    const text = await data.text();
    return JSON.parse(text);
  } catch {
    return [];
  }
}
