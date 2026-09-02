import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
async function sendWhatsAppPayload(a: any, b: any, c: any) { return true; }

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max execution time for Vercel Hobby/Pro

export async function GET() {
  const supabase = createSupabaseAdmin();
  
  try {
    // 1. Get campaigns that need processing
    const { data: campaigns, error } = await supabase
      .from('wa_campaigns')
      .select('*, whatsapp_accounts(phone_number_id, whatsapp_token)')
      .eq('status', 'draft')
      .or(`schedule_time.is.null,schedule_time.lte.${new Date().toISOString()}`)
      .limit(5);

    if (error || !campaigns || campaigns.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    let totalProcessed = 0;

    for (const campaign of campaigns) {
      // Mark as processing
      await supabase.from('wa_campaigns').update({ status: 'processing' }).eq('id', campaign.id);

      // Get contacts for this tenant
      const { data: contacts } = await supabase
        .from('contacts')
        .select('phone_number, customer_name, id')
        .eq('tenant_id', campaign.tenant_id);

      if (!contacts || contacts.length === 0) {
        await supabase.from('wa_campaigns').update({ status: 'completed', audience_count: 0 }).eq('id', campaign.id);
        continue;
      }

      let sentCount = 0;
      let failedCount = 0;

      // Extract token and phone_id
      const phoneId = campaign.whatsapp_accounts?.phone_number_id;
      const token = campaign.whatsapp_accounts?.whatsapp_token;

      if (!phoneId || !token) {
        await supabase.from('wa_campaigns').update({ status: 'failed', failed_count: contacts.length }).eq('id', campaign.id);
        continue;
      }

      // 2. Send messages in chunks to avoid rate limits
      const chunkSize = 20;
      for (let i = 0; i < contacts.length; i += chunkSize) {
        const chunk = contacts.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (contact) => {
          try {
            const payload = {
              messaging_product: "whatsapp",
              to: contact.phone_number,
              type: "template",
              template: {
                name: campaign.template_name,
                language: { code: campaign.template_language || 'es' }
              }
            };

            const success = await sendWhatsAppPayload(phoneId, token, payload);
            if (success) {
              sentCount++;
              
              // Upsert conversation to keep track
              await supabase.from('conversations').upsert({
                tenant_id: campaign.tenant_id,
                account_id: campaign.whatsapp_account_id,
                phone_number: contact.phone_number,
                customer_name: contact.customer_name || 'Desconocido',
                unread_count: 0,
                updated_at: new Date().toISOString(),
                status: 'open',
                is_human_mode: false
              }, {
                onConflict: 'tenant_id,account_id,phone_number'
              });

            } else {
              failedCount++;
            }
          } catch (err) {
            console.error('Error sending campaign message:', err);
            failedCount++;
          }
        }));
        
        // Small delay between chunks
        if (i + chunkSize < contacts.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Mark as completed
      await supabase.from('wa_campaigns').update({ 
        status: 'completed',
        audience_count: contacts.length,
        sent_count: sentCount,
        failed_count: failedCount
      }).eq('id', campaign.id);

      totalProcessed++;
    }

    return NextResponse.json({ success: true, processed: totalProcessed });
  } catch (error: any) {
    console.error('Error in cron campaigns worker:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
