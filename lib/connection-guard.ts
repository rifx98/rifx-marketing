// ============================================
// Evita que una misma cuenta de WhatsApp/Facebook/Meta Ads quede conectada a
// dos tenants distintos a la vez (causaría enrutamiento ambiguo de mensajes,
// o que dos negocios administren la misma cuenta publicitaria/página sin
// saberlo). facebook_ad_account_id y facebook_page_id viven dentro del JSON
// guardado en config.openai_key, así que hay que parsear cada fila para
// compararlos (no son columnas propias, no se puede filtrar con .eq() en SQL).
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js';

export async function findConflictingTenantForExtendedField(
  supabase: SupabaseClient,
  currentTenantId: string,
  field: 'facebook_ad_account_id' | 'facebook_page_id',
  value: string
): Promise<string | null> {
  if (!value) return null;

  const { data: rows } = await supabase
    .from('config')
    .select('tenant_id, openai_key')
    .neq('tenant_id', currentTenantId);

  for (const row of rows || []) {
    try {
      const parsed = JSON.parse(row.openai_key || '{}');
      if (parsed?.[field] && parsed[field] === value) {
        return row.tenant_id;
      }
    } catch {}
  }
  return null;
}
