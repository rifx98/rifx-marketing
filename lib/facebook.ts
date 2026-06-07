import { NextRequest } from 'next/server';
import { getTenantFromRequest } from './auth';
import { createSupabaseAdmin } from './supabase';

interface FacebookCredentials {
  token: string;
  adAccountId: string;
  pageId?: string;
}

function decodeExtendedConfig(stored: string) {
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

export async function getFacebookCredentials(req: NextRequest): Promise<FacebookCredentials> {
  const tenant = await getTenantFromRequest(req);
  
  if (!tenant?.tenantId) {
    throw new Error(
      'No autenticado. Inicia sesión para continuar.'
    );
  }

  const supabase = createSupabaseAdmin();
  const { data: config } = await supabase
    .from('config')
    .select('openai_key')
    .eq('tenant_id', tenant.tenantId)
    .limit(1)
    .maybeSingle();

  if (config?.openai_key) {
    const extended = decodeExtendedConfig(config.openai_key);
    const token = extended.facebook_access_token;
    const adAccountId = extended.facebook_ad_account_id;
    const pageId = extended.facebook_page_id;

    if (token && adAccountId) {
      return { token, adAccountId, pageId };
    }
  }

  // No credentials found for this tenant — do NOT fall back to system env vars.
  // Each tenant must configure their own Meta API credentials.
  throw new Error(
    'No tienes credenciales de Meta Ads configuradas. ' +
    'Ve a Configuración > Meta Ads en tu panel y configura tu Access Token y Ad Account ID propios.'
  );
}
