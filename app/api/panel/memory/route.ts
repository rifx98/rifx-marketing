import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
} from '@/lib/request-guards';

const DELETE_CONFIRMATION = 'DELETE_ALL_MEMORY';

async function authorize(req: NextRequest, namespace: string, attempts: number, windowMs: number) {
  const tenant = await getTenantFromRequest(req);
  if (!tenant?.tenantId) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const;
  }
  const featureDenied = denyUnlessFeature(tenant, 'crm');
  if (featureDenied) return { response: featureDenied } as const;
  const rateDenied = await enforceTenantRateLimit(namespace, tenant.tenantId, attempts, windowMs);
  if (rateDenied) return { response: rateDenied } as const;
  return { tenant } as const;
}

async function countRows(tenantId: string, before?: string) {
  const supabase = createSupabaseAdmin();
  let conversationQuery = supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if (before) {
    conversationQuery = conversationQuery.lt('updated_at', before);
    const conversations = await conversationQuery;
    if (conversations.error) throw new Error('memory_count_failed');
    // Messages are removed by the FK cascade. Counting them exactly for a
    // retention subset would require materializing every conversation ID.
    return { conversations: conversations.count || 0, messages: null };
  }
  const messageQuery = supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  const [conversations, messages] = await Promise.all([conversationQuery, messageQuery]);
  if (conversations.error || messages.error) throw new Error('memory_count_failed');
  return { conversations: conversations.count || 0, messages: messages.count || 0 };
}

export async function DELETE(req: NextRequest) {
  try {
    const authorization = await authorize(req, 'memory-delete-all', 3, 60 * 60_000);
    if ('response' in authorization) return authorization.response;
    if (!authorization.tenant.iat || Math.floor(Date.now() / 1000) - authorization.tenant.iat > 10 * 60) {
      return NextResponse.json(
        { error: 'Vuelve a iniciar sesion antes de borrar toda la memoria' },
        { status: 403 },
      );
    }
    const parsed = await readLimitedJsonObject(req, 2 * 1024);
    if (!parsed.ok) return parsed.response;
    if (parsed.body.confirm !== DELETE_CONFIRMATION) {
      return NextResponse.json({ error: 'Confirmacion de borrado invalida' }, { status: 400 });
    }

    const counts = await countRows(authorization.tenant.tenantId);
    const { error } = await createSupabaseAdmin()
      .from('conversations')
      .delete()
      .eq('tenant_id', authorization.tenant.tenantId);
    if (error) {
      console.error('Tenant memory deletion failed:', error.code || 'database_error');
      return internalApiError();
    }
    return NextResponse.json({ success: true, deleted: counts });
  } catch {
    console.error('Tenant memory deletion failed');
    return internalApiError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorize(req, 'memory-retention-purge', 10, 60 * 60_000);
    if ('response' in authorization) return authorization.response;
    const parsed = await readLimitedJsonObject(req, 2 * 1024);
    if (!parsed.ok) return parsed.response;
    const retentionDays = parsed.body.retentionDays;
    if (!Number.isSafeInteger(retentionDays) || Number(retentionDays) < 1 || Number(retentionDays) > 3_650) {
      return NextResponse.json({ error: 'retentionDays invalido' }, { status: 400 });
    }

    const cutoff = new Date(Date.now() - Number(retentionDays) * 24 * 60 * 60_000).toISOString();
    const counts = await countRows(authorization.tenant.tenantId, cutoff);
    const { error } = await createSupabaseAdmin()
      .from('conversations')
      .delete()
      .eq('tenant_id', authorization.tenant.tenantId)
      .lt('updated_at', cutoff);
    if (error) {
      console.error('Tenant memory retention purge failed:', error.code || 'database_error');
      return internalApiError();
    }
    return NextResponse.json({
      success: true,
      purged: { ...counts, olderThanDays: retentionDays },
    });
  } catch {
    console.error('Tenant memory retention purge failed');
    return internalApiError();
  }
}
