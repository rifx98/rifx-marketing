import type { SupabaseClient } from '@supabase/supabase-js';

const TERMINAL = new Set(['completed','cancelled','failed']);

export async function createCampaign(db: SupabaseClient, tenantId: string, input: {
  whatsappAccountId: string;
  name: string;
  templateName?: string;
  templateLanguage?: string;
  templateData?: Record<string, unknown>;
  segmentDefinition?: Record<string, unknown>;
  scheduledAt?: string | null;
  createdBy?: string | null;
}) {
  if (!input.name.trim()) throw new Error('El nombre de la campaña es obligatorio.');
  const { data: account, error: accountError } = await db
    .from('whatsapp_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', input.whatsappAccountId)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account) throw new Error('La cuenta de WhatsApp no pertenece al tenant.');

  const { data, error } = await db.from('wa_campaigns').insert({
    tenant_id: tenantId,
    whatsapp_account_id: input.whatsappAccountId,
    name: input.name.trim(),
    template_name: input.templateName || null,
    template_language: input.templateLanguage || null,
    template_data: input.templateData || {},
    segment_definition: input.segmentDefinition || {},
    scheduled_at: input.scheduledAt || null,
    status: input.scheduledAt ? 'scheduled' : 'draft',
    created_by: input.createdBy || null,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function addCampaignRecipients(db: SupabaseClient, tenantId: string, campaignId: string, recipients: Array<{
  phone: string;
  contactId?: string | null;
  variables?: Record<string, unknown>;
  excluded?: boolean;
}>) {
  const { data: campaign, error: campaignError } = await db
    .from('wa_campaigns')
    .select('id,whatsapp_account_id,status')
    .eq('tenant_id', tenantId)
    .eq('id', campaignId)
    .maybeSingle();
  if (campaignError) throw campaignError;
  if (!campaign) throw new Error('Campaña no encontrada.');
  if (TERMINAL.has(campaign.status)) throw new Error('No se pueden modificar destinatarios de una campaña finalizada.');

  const unique = new Map<string, typeof recipients[number]>();
  for (const r of recipients) {
    const phone = String(r.phone || '').replace(/[^\d]/g, '');
    if (phone) unique.set(phone, { ...r, phone });
  }

  const rows = [...unique.values()].map(r => ({
    tenant_id: tenantId,
    campaign_id: campaignId,
    whatsapp_account_id: campaign.whatsapp_account_id,
    contact_id: r.contactId || null,
    phone: r.phone,
    variables: r.variables || {},
    status: r.excluded ? 'excluded' : 'queued',
  }));

  if (!rows.length) return [];
  const { data, error } = await db
    .from('wa_campaign_recipients')
    .upsert(rows, { onConflict: 'campaign_id,phone', ignoreDuplicates: true })
    .select('*');
  if (error) throw error;
  return data || [];
}

export async function claimCampaignBatch(db: SupabaseClient, tenantId: string, campaignId: string, limit = 50) {
  const { data, error } = await db.rpc('claim_wa_campaign_batch', {
    p_tenant_id: tenantId,
    p_campaign_id: campaignId,
    p_limit: Math.min(Math.max(limit, 1), 500),
  });
  if (error) throw error;
  return data || [];
}

export async function markCampaignRecipientSent(db: SupabaseClient, tenantId: string, recipientId: string, providerMessageId: string) {
  const { error } = await db.from('wa_campaign_recipients').update({
    status: 'sent',
    provider_message_id: providerMessageId,
    sent_at: new Date().toISOString(),
    locked_at: null,
    updated_at: new Date().toISOString(),
  }).eq('tenant_id', tenantId).eq('id', recipientId);
  if (error) throw error;
}

export async function markCampaignRecipientFailed(db: SupabaseClient, tenantId: string, recipientId: string, input: {
  code?: string;
  message: string;
  retry?: boolean;
  retryAfterSeconds?: number;
}) {
  const retry = Boolean(input.retry);
  const nextAttempt = new Date(Date.now() + Math.max(5, input.retryAfterSeconds || 60) * 1000).toISOString();
  const { error } = await db.from('wa_campaign_recipients').update({
    status: retry ? 'queued' : 'failed',
    next_attempt_at: retry ? nextAttempt : new Date().toISOString(),
    failed_at: retry ? null : new Date().toISOString(),
    error_code: input.code || null,
    error_message: input.message.slice(0, 1000),
    locked_at: null,
    updated_at: new Date().toISOString(),
  }).eq('tenant_id', tenantId).eq('id', recipientId);
  if (error) throw error;
}

export async function updateRecipientFromWebhook(db: SupabaseClient, providerMessageId: string, event: 'delivered'|'read'|'replied'|'failed', errorMessage?: string) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: event, updated_at: now };
  if (event === 'delivered') patch.delivered_at = now;
  if (event === 'read') patch.read_at = now;
  if (event === 'replied') patch.replied_at = now;
  if (event === 'failed') { patch.failed_at = now; patch.error_message = errorMessage || null; }
  const { error } = await db.from('wa_campaign_recipients').update(patch).eq('provider_message_id', providerMessageId);
  if (error) throw error;
}

export async function pauseCampaign(db: SupabaseClient, tenantId: string, campaignId: string) {
  const { error } = await db.from('wa_campaigns').update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId).eq('id', campaignId).in('status', ['scheduled','running']);
  if (error) throw error;
}

export async function cancelCampaign(db: SupabaseClient, tenantId: string, campaignId: string) {
  const now = new Date().toISOString();
  const { error } = await db.from('wa_campaigns').update({ status: 'cancelled', completed_at: now, updated_at: now })
    .eq('tenant_id', tenantId).eq('id', campaignId).not('status', 'in', '(completed,cancelled)');
  if (error) throw error;
  await db.from('wa_campaign_recipients').update({ status: 'cancelled', updated_at: now })
    .eq('tenant_id', tenantId).eq('campaign_id', campaignId).in('status', ['queued','processing']);
}
