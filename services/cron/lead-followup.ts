import { createSupabaseAdmin } from '@/lib/supabase';
import { retryWithBackoff } from '@/app/api/cron/auth';
import OpenAI from 'openai';

export interface LeadFollowUpResult {
  found: number;
  processed: number;
  skipped: number;
  errors: number;
  errorDetails: any[];
  processedIds: string[];
  remaining: number;
}

/**
 * Servicio encargado de realizar el seguimiento automático de prospectos (leads) inactivos mediante Inteligencia Artificial.
 */
export async function runLeadFollowUps(options: {
  tenantId?: string;
  batchSize?: number;
  maxRetries?: number;
  startTime: number;
}): Promise<LeadFollowUpResult> {
  const supabase = createSupabaseAdmin();
  const now = new Date();

  const batchSize = options.batchSize || parseInt(process.env.FOLLOW_UP_BATCH_SIZE || '5');
  const maxRetries = options.maxRetries || parseInt(process.env.MAX_RETRIES || '3');
  const startTime = options.startTime;

  const result: LeadFollowUpResult = {
    found: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    processedIds: [],
    remaining: 0
  };

  try {
    // 1. Encontrar conversaciones inactivas (sin cambios en las últimas 24 horas)
    const rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('conversations')
      .select('*')
      .lt('updated_at', rangeStart);

    if (options.tenantId) {
      query = query.eq('tenant_id', options.tenantId);
    }

    const { data: convs, error } = await query;

    if (error) {
      throw new Error(`Error al buscar conversaciones en Supabase: ${error.message}`);
    }

    if (!convs || convs.length === 0) {
      console.log('[Lead Follow-Up Service] No hay conversaciones inactivas en la base de datos.');
      return result;
    }

    // Filtrar localmente para evitar fases finalizadas (won o lost)
    const inactiveLeads = convs.filter(c => {
      const stage = c.sales_stage || 'new_lead';
      return stage !== 'won' && stage !== 'lost';
    });

    result.found = inactiveLeads.length;

    // 2. Comprobación de idempotencia y frecuencia de seguimiento
    const pendingLeads: any[] = [];
    
    for (const conv of inactiveLeads) {
      const { data: lastMsgs, error: lastMsgsErr } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lastMsgsErr) {
        console.error(`[Lead Follow-Up Service] Error al consultar historial de mensajes para ${conv.id}:`, lastMsgsErr);
        continue;
      }

      if (lastMsgs && lastMsgs.length > 0) {
        const lastMsg = lastMsgs[0];
        const lastMsgTime = new Date(lastMsg.created_at).getTime();

        // Si el último mensaje es de hace menos de 24h, omitir (no molestar al usuario)
        if (now.getTime() - lastMsgTime < 24 * 60 * 60 * 1000) {
          result.skipped++;
          continue;
        }

        // Si el último mensaje ya es de seguimiento automatizado, omitir para evitar envíos recurrentes
        if (lastMsg.role === 'assistant' && (lastMsg.content.includes('🤖 [Seguimiento]') || lastMsg.content.includes('[Template enviado - ventana 24h cerrada]'))) {
          result.skipped++;
          continue;
        }
      }

      pendingLeads.push(conv);
    }

    // 3. Delimitar tamaño de lote
    const itemsToProcess = pendingLeads.slice(0, batchSize);
    result.remaining = Math.max(0, pendingLeads.length - batchSize);

    // 4. Procesar el lote secuencialmente cuidando los timeouts
    for (const conv of itemsToProcess) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 8.0) { // 2s de margen sobre el límite de 10s de Vercel Hobby
        console.warn(`[Lead Follow-Up Service] Timeout preventivo activado. Transcurridos: ${elapsed}s. Suspendiendo lote.`);
        result.remaining += itemsToProcess.length - itemsToProcess.indexOf(conv);
        break;
      }

      try {
        // Obtener configuración del tenant
        const { data: config, error: configErr } = await supabase
          .from('config')
          .select('*')
          .eq('tenant_id', conv.tenant_id)
          .limit(1)
          .maybeSingle();

        if (configErr) throw configErr;

        // Desencriptar / Parsear llaves de IA (JSON-encoded en openai_key)
        let extConfig = { openai_key: '', gemini_key: '', groq_key: '', model_selection: 'gpt-4o-mini' };
        if (config?.openai_key) {
          try {
            const p = JSON.parse(config.openai_key);
            extConfig.openai_key = p.openai_key || '';
            extConfig.gemini_key = p.gemini_key || '';
            extConfig.groq_key = p.groq_key || '';
            extConfig.model_selection = p.model_selection || 'gpt-4o-mini';
          } catch {
            extConfig.openai_key = config.openai_key || '';
          }
        }

        let selectedModel = extConfig.model_selection || 'gpt-4o-mini';
        let isGroq = selectedModel.startsWith('llama') || selectedModel.startsWith('mixtral');
        let isGemini = selectedModel.startsWith('gemini');
        let isOpenAI = !isGroq && !isGemini;

        let apiKey = '';
        if (isGroq) apiKey = extConfig.groq_key || process.env.GROQ_API_KEY || '';
        else if (isGemini) apiKey = extConfig.gemini_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
        else apiKey = extConfig.openai_key || process.env.OPENAI_API_KEY || '';

        // Fallback de seguridad en caso de ausencia de API keys específicas
        if (!apiKey || apiKey.length < 10) {
          const fallbackOptions = [
            { key: extConfig.groq_key || process.env.GROQ_API_KEY || '', model: 'llama-3.3-70b-versatile', name: 'Groq' },
            { key: extConfig.openai_key || process.env.OPENAI_API_KEY || '', model: 'gpt-4o-mini', name: 'OpenAI' },
            { key: extConfig.gemini_key || process.env.GEMINI_API_KEY || '', model: 'gemini-2.0-flash', name: 'Gemini' },
          ];
          for (const fb of fallbackOptions) {
            if (fb.key && fb.key.length >= 10) {
              apiKey = fb.key;
              selectedModel = fb.model;
              isGroq = selectedModel.startsWith('llama') || selectedModel.startsWith('mixtral');
              isGemini = selectedModel.startsWith('gemini');
              isOpenAI = !isGroq && !isGemini;
              break;
            }
          }
        }

        if (!apiKey || apiKey.length < 10) {
          throw new Error(`Credenciales de IA no configuradas para el tenant: ${conv.tenant_id}`);
        }

        // Consultar el historial de chat (últimos 10 mensajes)
        const { data: historyMsgs } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true })
          .limit(10);

        // Armar el prompt del sistema personalizado de seguimiento
        const systemPrompt = `${config?.ai_prompt || 'Eres Nova, un asesor de ventas de RIFX Marketing. Eres amigable, profesional y persuasivo.'}
        
[INSTRUCCIÓN DE SEGUIMIENTO AUTOMÁTICO]: El cliente ha estado inactivo durante más de 24 horas. Escribe un mensaje de seguimiento muy corto, persuasivo, amigable y personalizado para reenganchar al cliente y ver si sigue interesado en nuestros servicios.
Revisa el historial de la conversación anterior para personalizar el mensaje según sus intereses o su última pregunta.
NO inventes información. Mantén el mensaje sumamente breve (máximo 2 párrafos) y directo. Termina con una pregunta abierta. No agregues etiquetas técnicas ni [GENERAR_PAGO].`;

        const chatMessages = [
          { role: 'system', content: systemPrompt },
          ...(historyMsgs || []).map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          }))
        ];

        let aiResponse = '';

        // Generar respuesta IA
        await retryWithBackoff(async () => {
          if (isGemini) {
            const systemMsg = chatMessages.find(m => m.role === 'system');
            const nonSystemMsgs = chatMessages.filter(m => m.role !== 'system');
            
            const geminiContents: any[] = [];
            for (const m of nonSystemMsgs) {
              const gemRole = m.role === 'assistant' ? 'model' : 'user';
              const last = geminiContents[geminiContents.length - 1];
              if (last && last.role === gemRole) {
                last.parts[0].text += '\n' + m.content;
              } else {
                geminiContents.push({ role: gemRole, parts: [{ text: m.content }] });
              }
            }
            if (geminiContents.length > 0 && geminiContents[0].role !== 'user') {
              geminiContents.unshift({ role: 'user', parts: [{ text: 'Hola' }] });
            }

            const geminiPayload: any = {
              contents: geminiContents,
              generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
            };
            if (systemMsg) {
              geminiPayload.systemInstruction = { parts: [{ text: systemMsg.content }] };
            }

            const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(geminiPayload),
            });
            const gemData = await gemRes.json();
            if (gemData?.error) throw new Error(gemData.error.message);
            aiResponse = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else {
            const client = new OpenAI({
              apiKey,
              baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined,
            });
            const completion = await client.chat.completions.create({
              model: selectedModel,
              messages: chatMessages as any,
              max_tokens: 300,
              temperature: 0.7,
            });
            aiResponse = completion.choices[0]?.message?.content || '';
          }

          if (!aiResponse) {
            throw new Error('IA devolvió respuesta vacía.');
          }
        }, maxRetries);

        // Obtener credenciales de WhatsApp
        let waToken = config?.whatsapp_token || process.env.WHATSAPP_TOKEN;
        let phoneId = config?.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (waToken && waToken.length < 20) waToken = process.env.WHATSAPP_TOKEN;
        if (phoneId && phoneId.length < 5) phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (!waToken || !phoneId) {
          throw new Error(`Credenciales de WhatsApp incompletas para el tenant: ${conv.tenant_id}`);
        }

        // 5. Enviar mensaje por WhatsApp
        let sentMethod = 'text';
        try {
          await retryWithBackoff(async () => {
            const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${waToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: conv.phone_number,
                type: 'text',
                text: { body: aiResponse },
              }),
            });

            const resData = await response.json();
            if (!response.ok) {
              const errorCode = resData?.error?.code;
              const errorSubcode = resData?.error?.error_subcode;
              // Error que indica que la sesión está cerrada (fuera de la ventana de 24 horas)
              const is24hWindow = errorCode === 131047 || errorCode === 131026 || errorCode === 130472 || errorSubcode === 2534050;
              if (is24hWindow) {
                const winErr = new Error('24h_window_closed');
                (winErr as any).status = 403;
                throw winErr;
              }
              throw new Error(`Meta API error: ${JSON.stringify(resData)}`);
            }
          }, maxRetries);
        } catch (waErr: any) {
          if (waErr.message === '24h_window_closed') {
            console.log(`[Lead Follow-Up Service] Ventana 24h cerrada para ${conv.phone_number}. Enviando plantilla hello_world...`);
            
            // Envío de plantilla hello_world como contingencia
            await retryWithBackoff(async () => {
              const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${waToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: conv.phone_number,
                  type: 'template',
                  template: {
                    name: 'hello_world',
                    language: { code: 'en_US' }
                  }
                }),
              });

              const resData = await response.json();
              if (!response.ok) {
                throw new Error(`Meta Template API error: ${JSON.stringify(resData)}`);
              }
            }, maxRetries);

            sentMethod = 'template';
          } else {
            throw waErr;
          }
        }

        // 6. Registrar en el historial del chat
        const historyText = sentMethod === 'template' 
          ? `[Template enviado - ventana 24h cerrada]\n${aiResponse}`
          : `🤖 [Seguimiento]: ${aiResponse}`;

        await supabase.from('messages').insert({
          conversation_id: conv.id,
          role: 'assistant',
          content: historyText,
        });

        // Forzar actualización de updated_at en la conversación
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conv.id);

        result.processed++;
        result.processedIds.push(conv.id);
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push({ conversationId: conv.id, error: err.message || err });
        console.error(`[Lead Follow-Up Service] Error al procesar conversación ${conv.id}:`, err);
      }
    }
  } catch (err: any) {
    result.errors++;
    result.errorDetails.push({ error: err.message || err });
    console.error('[Lead Follow-Up Service] Error crítico:', err);
  }

  return result;
}
