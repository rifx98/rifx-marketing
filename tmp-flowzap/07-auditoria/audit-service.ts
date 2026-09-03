import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

function hashIp(ip?: string | null) {
  if (!ip) return null;
  const salt = process.env.AUDIT_IP_SALT || process.env.FLOWZAP_SECRET_KEY || 'audit';
  return crypto.createHmac('sha256', salt).update(ip).digest('hex');
}

export async function audit(db: SupabaseClient, tenantId: string, input: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  whatsappAccountId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!input.action || !input.entityType) throw new Error('action y entityType son obligatorios para auditoría.');
  const { error } = await db.from('audit_log').insert({
    tenant_id: tenantId,
    actor_user_id: input.actorUserId || null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId || null,
    whatsapp_account_id: input.whatsappAccountId || null,
    ip_hash: hashIp(input.ip),
    user_agent: input.userAgent?.slice(0, 500) || null,
    metadata: input.metadata || {},
  });
  if (error) throw error;
}
