const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const root = path.resolve(__dirname, '..');
const { createClient } = require(path.join(root, 'node_modules/@supabase/supabase-js'));
require(path.join(root, 'node_modules/dotenv')).config({ path: path.join(root, '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const lines = fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n');
let appSecret = '';
lines.forEach(l => {
  if (l.startsWith('WHATSAPP_APP_SECRET=')) appSecret = l.split('=')[1].trim().replace(/^["']|["']$/g, '');
});

const workerSecret = process.env.WHATSAPP_WORKER_SECRET || process.env.CRON_SECRET;

let isProcessing = false;

async function drainPending() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    while (true) {
      const { data: pending, error } = await supabase
        .from('whatsapp_ingress')
        .select('id, provider_message_id, destination_phone_id, payload, tenant_id, attempt_count')
        .in('status', ['queued', 'retry'])
        .order('created_at', { ascending: true })
        .limit(5);

      if (error || !pending || pending.length === 0) {
        break;
      }

      for (const item of pending) {
        console.log(`[Local WhatsApp Drainer] ⚡ Processing message instantly: ${item.provider_message_id}`);
        const rawBody = JSON.stringify(item.payload);
        const signature = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
        const destinationPhoneId = item.destination_phone_id
          || item.payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id
          || '1099202103278354';

        try {
          const t0 = Date.now();
          const res = await fetch('http://localhost:3000/api/whatsapp', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${workerSecret}`,
              'Content-Type': 'application/json',
              'x-hub-signature-256': signature,
              'x-rifx-whatsapp-worker': '1',
              'x-rifx-whatsapp-tenant-id': item.tenant_id,
              'x-rifx-whatsapp-provider-message-id': item.provider_message_id,
              'x-rifx-whatsapp-destination-phone-id': destinationPhoneId,
            },
            body: rawBody,
          });

          const elapsed = Date.now() - t0;
          if (res.ok) {
            console.log(`[Local WhatsApp Drainer] ✅ Successfully processed ${item.provider_message_id} in ${elapsed}ms`);
            await supabase.from('whatsapp_ingress').update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              last_error_code: null
            }).eq('id', item.id);
          } else {
            console.error(`[Local WhatsApp Drainer] ⚠️ Processor returned ${res.status}:`, await res.text());
          }
        } catch (postErr) {
          console.error(`[Local WhatsApp Drainer] ❌ Post error:`, postErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[Local WhatsApp Drainer] Drain error:', err.message);
  } finally {
    isProcessing = false;
  }
}

async function start() {
  console.log('[Local WhatsApp Drainer] 🚀 High-speed WhatsApp ingress drainer active (Realtime + 250ms polling)...');

  // 1. Listen via Supabase Realtime for instant notification (0-50ms)
  try {
    supabase
      .channel('realtime_whatsapp_ingress')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_ingress' },
        () => {
          drainPending();
        }
      )
      .subscribe((status) => {
        console.log(`[Local WhatsApp Drainer] Realtime channel status: ${status}`);
      });
  } catch (e) {
    console.warn('[Local WhatsApp Drainer] Realtime subscription warning:', e.message);
  }

  // 2. Continuous fallback fast-polling loop (250ms)
  while (true) {
    await drainPending();
    await new Promise(r => setTimeout(r, 250));
  }
}

start();
