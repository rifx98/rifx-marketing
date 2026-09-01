import { createClient } from '@supabase/supabase-js';
import { retryWithBackoff } from '@/app/api/cron/auth';

interface AutoResumeResult {
  found: number;
  processed: number;
  skipped: number;
  errors: number;
  remaining: number;
  errorDetails: any[];
  processedIds: string[];
}

/**
 * Searches for conversations that have been waiting for human attention for too long (> 2 hours)
 * and automatically resumes the bot.
 */
export async function runAutoResume(options: { startTime: number }): Promise<AutoResumeResult> {
  const { startTime } = options;
  const result: AutoResumeResult = {
    found: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    remaining: 0,
    errorDetails: [],
    processedIds: []
  };
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: conversations, error: fetchErr } = await supabase
      .from('conversations')
      .select('id, tenant_id, phone_number, is_paused, status, updated_at')
      .eq('status', 'requires_attention')
      .eq('is_paused', true)
      .lt('updated_at', twoHoursAgo)
      .limit(50); // Process up to 50 per run

    if (fetchErr) throw fetchErr;
    if (!conversations || conversations.length === 0) return result;

    result.found = conversations.length;
    const itemsToProcess = conversations;
    const concurrency = 5;

    const processOne = async (conv: any) => {
      try {
        const { data: tenantConfig, error: configErr } = await supabase
          .from('config')
          .select('whatsapp_token, whatsapp_phone_id')
          .eq('tenant_id', conv.tenant_id)
          .limit(1)
          .maybeSingle();

        if (configErr || !tenantConfig) {
          throw new Error(`Configuración de WhatsApp no encontrada para el tenant: ${conv.tenant_id}`);
        }

        const token = tenantConfig.whatsapp_token;
        const phoneId = tenantConfig.whatsapp_phone_id;

        if (!token || !phoneId) {
          throw new Error(`Credenciales de WhatsApp incompletas para el tenant: ${conv.tenant_id}`);
        }

        const resumeMessage = `Por el momento no hay una persona disponible para atenderte. He reactivado nuestro asistente automático para seguir ayudándote en lo que pueda. 🤖`;

        // Send WhatsApp message
        await retryWithBackoff(async () => {
          const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: conv.phone_number,
              type: 'text',
              text: { body: resumeMessage },
            }),
          });

          const resData = await response.json();
          // Ignorar errores de 24h window para reactivar de todos modos en la DB
          if (!response.ok && !is24hWindowError(resData)) {
            throw new Error(`Meta API error: ${JSON.stringify(resData)}`);
          }
          return resData;
        }, 3);

        console.log(`[Auto-Resume Service] Reactivando conversación ${conv.id}`);

        // Update database (resume bot)
        await supabase
          .from('conversations')
          .update({
            status: 'chatting',
            is_paused: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', conv.id);

        // Record automated reply and internal resume signal
        await supabase.from('messages').insert([
          {
            conversation_id: conv.id,
            role: 'assistant',
            content: '__SYSTEM_RESUME__',
          },
          {
            conversation_id: conv.id,
            role: 'assistant',
            content: resumeMessage,
          }
        ]);

        result.processed++;
        result.processedIds.push(conv.id);
      } catch (err: any) {
        result.errors++;
        result.errorDetails.push({ conversationId: conv.id, error: err.message || err });
        console.error(`[Auto-Resume Service] Error en conv ${conv.id}:`, err);
      }
    };

    for (let i = 0; i < itemsToProcess.length; i += concurrency) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 8.0) { // 2s margin for Vercel Hobby limits
        console.warn(`[Auto-Resume Service] Timeout preventivo activado. Transcurridos: ${elapsed}s. Suspendiendo lote.`);
        result.remaining += itemsToProcess.length - i;
        break;
      }

      const chunk = itemsToProcess.slice(i, i + concurrency);
      await Promise.allSettled(chunk.map(processOne));
    }

  } catch (err: any) {
    result.errors++;
    result.errorDetails.push({ error: err.message || err });
    console.error('[Auto-Resume Service] Error general:', err);
  }

  return result;
}

// Helper: Check if error is due to 24h window expiration
function is24hWindowError(waResult: any): boolean {
  const errorCode = waResult?.error?.code;
  const errorSubcode = waResult?.error?.error_subcode;
  const errorMsg = (waResult?.error?.message || '').toLowerCase();
  
  return (
    errorCode === 131047 ||
    errorCode === 131026 ||
    errorCode === 130472 ||
    errorSubcode === 2534050 ||
    errorMsg.includes('24') ||
    errorMsg.includes('session') ||
    errorMsg.includes('window') ||
    errorMsg.includes('re-engage') ||
    errorMsg.includes('template')
  );
}
