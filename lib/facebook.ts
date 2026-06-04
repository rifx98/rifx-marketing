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
  
  if (tenant?.tenantId) {
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
  }

  // Fallback to system-level defaults in .env.local
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  const adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  if (!token || !adAccountId) {
    throw new Error('Faltan credenciales de Facebook Marketing API');
  }

  return { token, adAccountId, pageId };
}
