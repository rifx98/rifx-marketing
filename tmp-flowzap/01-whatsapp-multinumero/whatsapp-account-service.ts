import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret, encryptSecret } from './secret-crypto';

export type WhatsAppAccount = {
  id: string;
  tenant_id: string;
  name: string;
  provider: string;
  phone_number: string | null;
  phone_number_id: string;
  business_account_id: string | null;
  status: 'active' | 'inactive' | 'error';
  is_default: boolean;
  legacy_config_backed: boolean;
  metadata: Record<string, unknown>;
};

export async function listWhatsAppAccounts(db: SupabaseClient, tenantId: string): Promise<WhatsAppAccount[]> {
  const { data, error } = await db
    .from('whatsapp_accounts')
    .select('id,tenant_id,name,provider,phone_number,phone_number_id,business_account_id,status,is_default,legacy_config_backed,metadata')
    .eq('tenant_id', tenantId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as WhatsAppAccount[];
}

export async function assertWhatsAppAccountOwnership(db: SupabaseClient, tenantId: string, accountId: string): Promise<WhatsAppAccount> {
  const { data, error } = await db
    .from('whatsapp_accounts')
    .select('id,tenant_id,name,provider,phone_number,phone_number_id,business_account_id,status,is_default,legacy_config_backed,metadata')
    .eq('tenant_id', tenantId)
    .eq('id', accountId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Cuenta de WhatsApp no encontrada o no pertenece al tenant.');
  return data as WhatsAppAccount;
}

export async function createWhatsAppAccount(
  db: SupabaseClient,
  tenantId: string,
  input: {
    name: string;
    phoneNumber?: string;
    phoneNumberId: string;
    businessAccountId?: string;
    accessToken: string;
    verifyToken?: string;
    appSecret?: string;
    isDefault?: boolean;
  },
) {
  if (!input.name.trim() || !input.phoneNumberId.trim() || !input.accessToken.trim()) {
    throw new Error('Nombre, phoneNumberId y accessToken son obligatorios.');
  }

  if (input.isDefault) {
    const { error: clearError } = await db
      .from('whatsapp_accounts')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('is_default', true);
    if (clearError) throw clearError;
  }

  const { data, error } = await db
    .from('whatsapp_accounts')
    .insert({
      tenant_id: tenantId,
      name: input.name.trim(),
      phone_number: input.phoneNumber?.trim() || null,
      phone_number_id: input.phoneNumberId.trim(),
      business_account_id: input.businessAccountId?.trim() || null,
      access_token_encrypted: encryptSecret(input.accessToken.trim()),
      verify_token_encrypted: input.verifyToken ? encryptSecret(input.verifyToken) : null,
      app_secret_encrypted: input.appSecret ? encryptSecret(input.appSecret) : null,
      is_default: Boolean(input.isDefault),
      legacy_config_backed: false,
      status: 'active',
    })
    .select('id,tenant_id,name,provider,phone_number,phone_number_id,business_account_id,status,is_default,legacy_config_backed,metadata')
    .single();
  if (error) throw error;
  return data as WhatsAppAccount;
}

export async function resolveWhatsAppCredentials(db: SupabaseClient, tenantId: string, accountId: string) {
  const { data: row, error } = await db
    .from('whatsapp_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', accountId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error('Cuenta de WhatsApp no encontrada.');

  let accessToken = row.access_token_encrypted ? decryptSecret(row.access_token_encrypted) : '';
  let verifyToken = row.verify_token_encrypted ? decryptSecret(row.verify_token_encrypted) : '';
  let appSecret = row.app_secret_encrypted ? decryptSecret(row.app_secret_encrypted) : '';

  if (!accessToken && row.legacy_config_backed) {
    const { data: config, error: configError } = await db
      .from('config')
      .select('whatsapp_token')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (configError) throw configError;
    accessToken = String(config?.whatsapp_token || '');
  }

  if (!accessToken) throw new Error('La cuenta de WhatsApp no tiene access token disponible.');

  return {
    accountId: row.id as string,
    phoneNumberId: row.phone_number_id as string,
    businessAccountId: (row.business_account_id || '') as string,
    accessToken,
    verifyToken,
    appSecret,
  };
}
