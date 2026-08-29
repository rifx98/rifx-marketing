import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { findConflictingTenantForExtendedField } from '@/lib/connection-guard';
import { redactSecret, resolveSecretUpdate } from '@/lib/security';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
} from '@/lib/request-guards';

const ALERT_EMAIL_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const PHONE_ID_PATTERN = /^\d{6,30}$/;
const ALERT_PHONE_PATTERN = /^\d{7,20}$/;
const META_AD_ACCOUNT_PATTERN = /^(?:act_)?\d{1,32}$/;
const META_PAGE_PATTERN = /^\d{1,32}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]*$/;
const MODELS = new Set([
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
]);
const VISUAL_PROVIDERS = new Set(['openai', 'flux']);

interface ExtendedConfig {
  openai_key: string;
  gemini_key: string;
  groq_key: string;
  bulk_wa_token: string;
  bulk_wa_phone_id: string;
  model_selection: string;
  confidence_threshold: number;
  auto_classification: boolean;
  fal_key: string;
  visual_render_provider: string;
  facebook_access_token: string;
  facebook_ad_account_id: string;
  facebook_page_id: string;
  meta_ad_account_name: string;
  meta_page_name: string;
  dropi_enabled: boolean;
  dropi_token: string;
  dropi_default_product_id: string;
  dropi_default_price: number;
  dropi_prompt: string;
  sales_prompt: string;
  support_prompt: string;
  admin_notification_phone: string;
}

const EXTENDED_DEFAULTS: ExtendedConfig = {
  openai_key: '',
  gemini_key: '',
  groq_key: '',
  bulk_wa_token: '',
  bulk_wa_phone_id: '',
  model_selection: 'gpt-4o',
  confidence_threshold: 0.85,
  auto_classification: true,
  fal_key: '',
  visual_render_provider: 'flux',
  facebook_access_token: '',
  facebook_ad_account_id: '',
  facebook_page_id: '',
  meta_ad_account_name: '',
  meta_page_name: '',
  dropi_enabled: false,
  dropi_token: '',
  dropi_default_product_id: '',
  dropi_default_price: 50,
  dropi_prompt: '',
  sales_prompt: '',
  support_prompt: '',
  admin_notification_phone: '',
};

const EMPTY_CONFIG = {
  whatsapp_token: '',
  whatsapp_phone_id: '',
  openai_key: '',
  gemini_key: '',
  groq_key: '',
  alert_email: '',
  email_alerts: false,
  push_notifications: false,
  monthly_briefing: false,
  bulk_wa_token: '',
  bulk_wa_phone_id: '',
  payphone_token: '',
  payphone_store_id: '',
  ai_prompt: '',
  media_retention_days: 0,
  whatsapp_token_configured: false,
  openai_key_configured: false,
  gemini_key_configured: false,
  groq_key_configured: false,
  fal_key_configured: false,
  bulk_wa_token_configured: false,
  payphone_token_configured: false,
  facebook_access_token_configured: false,
  dropi_token_configured: false,
};

class ConfigInputError extends Error {}

function storedString(value: unknown, maxLength: number, fallback = ''): string {
  return typeof value === 'string' && value.length <= maxLength ? value : fallback;
}

function storedNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

function decodeExtendedConfig(stored: unknown): ExtendedConfig {
  if (typeof stored !== 'string' || !stored) return { ...EXTENDED_DEFAULTS };
  let parsed: Record<string, unknown>;
  try {
    const candidate: unknown = JSON.parse(stored);
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return { ...EXTENDED_DEFAULTS };
    }
    parsed = candidate as Record<string, unknown>;
  } catch {
    return { ...EXTENDED_DEFAULTS, openai_key: storedString(stored, 8_192) };
  }

  const model = storedString(parsed.model_selection, 80, EXTENDED_DEFAULTS.model_selection);
  const visualProvider = storedString(
    parsed.visual_render_provider,
    20,
    EXTENDED_DEFAULTS.visual_render_provider,
  );
  return {
    openai_key: storedString(parsed.openai_key, 8_192),
    gemini_key: storedString(parsed.gemini_key, 8_192),
    groq_key: storedString(parsed.groq_key, 8_192),
    bulk_wa_token: storedString(parsed.bulk_wa_token, 8_192),
    bulk_wa_phone_id: storedString(parsed.bulk_wa_phone_id, 30),
    model_selection: MODELS.has(model) ? model : EXTENDED_DEFAULTS.model_selection,
    confidence_threshold: storedNumber(parsed.confidence_threshold, 0.5, 0.99, 0.85),
    auto_classification: typeof parsed.auto_classification === 'boolean' ? parsed.auto_classification : true,
    fal_key: storedString(parsed.fal_key, 8_192),
    visual_render_provider: VISUAL_PROVIDERS.has(visualProvider) ? visualProvider : 'flux',
    facebook_access_token: storedString(parsed.facebook_access_token, 8_192),
    facebook_ad_account_id: storedString(parsed.facebook_ad_account_id, 40),
    facebook_page_id: storedString(parsed.facebook_page_id, 32),
    meta_ad_account_name: storedString(parsed.meta_ad_account_name, 200),
    meta_page_name: storedString(parsed.meta_page_name, 200),
    dropi_enabled: typeof parsed.dropi_enabled === 'boolean' ? parsed.dropi_enabled : false,
    dropi_token: storedString(parsed.dropi_token, 8_192),
    dropi_default_product_id: storedString(parsed.dropi_default_product_id, 128),
    dropi_default_price: storedNumber(parsed.dropi_default_price, 0, 99_999_999.99, 50),
    dropi_prompt: storedString(parsed.dropi_prompt, 20_000),
    sales_prompt: storedString(parsed.sales_prompt, 20_000),
    support_prompt: storedString(parsed.support_prompt, 20_000),
    admin_notification_phone: storedString(parsed.admin_notification_phone, 20),
  };
}

function inputString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') throw new ConfigInputError('Campo de texto invalido');
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new ConfigInputError('Campo de texto demasiado largo');
  return normalized;
}

function updatedString(value: unknown, current: string, maxLength: number): string {
  return value === undefined ? current : inputString(value, maxLength);
}

function updatedSecret(value: unknown, current: string): string {
  if (value !== undefined && typeof value !== 'string') throw new ConfigInputError('Credencial invalida');
  const updated = resolveSecretUpdate(value, current);
  if (updated.length > 8_192) throw new ConfigInputError('Credencial demasiado larga');
  return updated;
}

function updatedBoolean(value: unknown, current: boolean): boolean {
  if (value === undefined) return current;
  if (typeof value !== 'boolean') throw new ConfigInputError('Valor booleano invalido');
  return value;
}

function updatedNumber(value: unknown, current: number, min: number, max: number): number {
  if (value === undefined) return current;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ConfigInputError('Valor numerico invalido');
  }
  return value;
}

function assertPattern(value: string, pattern: RegExp, field: string) {
  if (value && !pattern.test(value)) throw new ConfigInputError(`${field} invalido`);
}

function encodeExtendedConfig(fields: ExtendedConfig): string {
  return JSON.stringify(fields);
}

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const rateDenied = await enforceTenantRateLimit('panel-config-read', tenant.tenantId, 120, 60_000);
    if (rateDenied) return rateDenied;

    const { data: config, error } = await createSupabaseAdmin()
      .from('config')
      .select('whatsapp_token,whatsapp_phone_id,wa_display_phone,openai_key,payphone_token,payphone_store_id,ai_prompt,media_retention_days,alert_email,email_alerts,push_notifications,monthly_briefing')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();
    if (error) {
      console.error('Panel configuration lookup failed:', error.code || 'database_error');
      return internalApiError();
    }
    if (!config) {
      return NextResponse.json(EMPTY_CONFIG, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    const extended = decodeExtendedConfig(config.openai_key);
    return NextResponse.json({
      whatsapp_token: redactSecret(config.whatsapp_token),
      whatsapp_token_configured: Boolean(config.whatsapp_token),
      whatsapp_phone_id: storedString(config.whatsapp_phone_id, 30),
      wa_display_phone: storedString(config.wa_display_phone, 40),
      openai_key: redactSecret(extended.openai_key),
      openai_key_configured: Boolean(extended.openai_key),
      gemini_key: redactSecret(extended.gemini_key),
      gemini_key_configured: Boolean(extended.gemini_key),
      groq_key: redactSecret(extended.groq_key),
      groq_key_configured: Boolean(extended.groq_key),
      fal_key: redactSecret(extended.fal_key),
      fal_key_configured: Boolean(extended.fal_key),
      alert_email: config.alert_email,
      email_alerts: config.email_alerts === true,
      push_notifications: config.push_notifications === true,
      monthly_briefing: config.monthly_briefing === true,
      bulk_wa_token: redactSecret(extended.bulk_wa_token),
      bulk_wa_token_configured: Boolean(extended.bulk_wa_token),
      bulk_wa_phone_id: extended.bulk_wa_phone_id,
      payphone_token: redactSecret(config.payphone_token),
      payphone_token_configured: Boolean(config.payphone_token),
      payphone_store_id: storedString(config.payphone_store_id, 200),
      ai_prompt: storedString(config.ai_prompt, 40_000),
      media_retention_days: storedNumber(config.media_retention_days, 0, 3_650, 0),
      model_selection: extended.model_selection,
      confidence_threshold: extended.confidence_threshold,
      auto_classification: extended.auto_classification,
      visual_render_provider: extended.visual_render_provider,
      facebook_access_token: redactSecret(extended.facebook_access_token),
      facebook_access_token_configured: Boolean(extended.facebook_access_token),
      facebook_ad_account_id: extended.facebook_ad_account_id,
      facebook_page_id: extended.facebook_page_id,
      meta_ad_account_name: extended.meta_ad_account_name,
      meta_page_name: extended.meta_page_name,
      dropi_enabled: extended.dropi_enabled,
      dropi_token: redactSecret(extended.dropi_token),
      dropi_token_configured: Boolean(extended.dropi_token),
      dropi_default_product_id: extended.dropi_default_product_id,
      dropi_default_price: extended.dropi_default_price,
      dropi_prompt: extended.dropi_prompt,
      sales_prompt: extended.sales_prompt,
      support_prompt: extended.support_prompt,
      admin_notification_phone: extended.admin_notification_phone,
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' } });
  } catch {
    console.error('Panel configuration request failed');
    return internalApiError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const rateDenied = await enforceTenantRateLimit('panel-config-write', tenant.tenantId, 20, 60_000);
    if (rateDenied) return rateDenied;
    const parsed = await readLimitedJsonObject(req, 128 * 1024);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;
    const supabase = createSupabaseAdmin();

    const { data: existing, error: existingError } = await supabase
      .from('config')
      .select('id,openai_key,whatsapp_token,payphone_token')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle();
    if (existingError) {
      console.error('[Config] State lookup failed:', existingError);
      return NextResponse.json({ error: `Database error (lookup): ${existingError.message || existingError.code}` }, { status: 500 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.alert_email !== undefined) {
      const alertEmail = inputString(body.alert_email, 254).toLowerCase();
      if (alertEmail && !ALERT_EMAIL_PATTERN.test(alertEmail)) throw new ConfigInputError('Correo invalido');
      updateData.alert_email = alertEmail || null;
    }
    for (const preference of ['email_alerts', 'push_notifications', 'monthly_briefing'] as const) {
      if (body[preference] !== undefined) updateData[preference] = updatedBoolean(body[preference], false);
    }

    const current = decodeExtendedConfig(existing?.openai_key);
    const extendedFields = new Set([
      'openai_key', 'gemini_key', 'groq_key', 'bulk_wa_token', 'bulk_wa_phone_id',
      'model_selection', 'confidence_threshold', 'auto_classification', 'fal_key',
      'visual_render_provider', 'facebook_access_token', 'facebook_ad_account_id',
      'facebook_page_id', 'meta_ad_account_name', 'meta_page_name', 'dropi_enabled',
      'dropi_token', 'dropi_default_product_id', 'dropi_default_price', 'dropi_prompt',
      'sales_prompt', 'support_prompt', 'admin_notification_phone',
    ]);
    if (Object.keys(body).some((key) => extendedFields.has(key))) {
      const next: ExtendedConfig = {
        openai_key: updatedSecret(body.openai_key, current.openai_key),
        gemini_key: updatedSecret(body.gemini_key, current.gemini_key),
        groq_key: updatedSecret(body.groq_key, current.groq_key),
        bulk_wa_token: updatedSecret(body.bulk_wa_token, current.bulk_wa_token),
        bulk_wa_phone_id: updatedString(body.bulk_wa_phone_id, current.bulk_wa_phone_id, 30),
        model_selection: updatedString(body.model_selection, current.model_selection, 80),
        confidence_threshold: updatedNumber(body.confidence_threshold, current.confidence_threshold, 0.5, 0.99),
        auto_classification: updatedBoolean(body.auto_classification, current.auto_classification),
        fal_key: updatedSecret(body.fal_key, current.fal_key),
        visual_render_provider: updatedString(body.visual_render_provider, current.visual_render_provider, 20),
        facebook_access_token: updatedSecret(body.facebook_access_token, current.facebook_access_token),
        facebook_ad_account_id: updatedString(body.facebook_ad_account_id, current.facebook_ad_account_id, 40),
        facebook_page_id: updatedString(body.facebook_page_id, current.facebook_page_id, 32),
        meta_ad_account_name: updatedString(body.meta_ad_account_name, current.meta_ad_account_name, 200),
        meta_page_name: updatedString(body.meta_page_name, current.meta_page_name, 200),
        dropi_enabled: updatedBoolean(body.dropi_enabled, current.dropi_enabled),
        dropi_token: updatedSecret(body.dropi_token, current.dropi_token),
        dropi_default_product_id: updatedString(body.dropi_default_product_id, current.dropi_default_product_id, 128),
        dropi_default_price: updatedNumber(body.dropi_default_price, current.dropi_default_price, 0, 99_999_999.99),
        dropi_prompt: updatedString(body.dropi_prompt, current.dropi_prompt, 20_000),
        sales_prompt: updatedString(body.sales_prompt, current.sales_prompt, 20_000),
        support_prompt: updatedString(body.support_prompt, current.support_prompt, 20_000),
        admin_notification_phone: updatedString(body.admin_notification_phone, current.admin_notification_phone, 20),
      };
      assertPattern(next.bulk_wa_phone_id, PHONE_ID_PATTERN, 'Phone ID masivo');
      assertPattern(next.facebook_ad_account_id, META_AD_ACCOUNT_PATTERN, 'Cuenta publicitaria');
      assertPattern(next.facebook_page_id, META_PAGE_PATTERN, 'Pagina de Facebook');
      assertPattern(next.dropi_default_product_id, IDENTIFIER_PATTERN, 'Producto Dropi');
      assertPattern(next.admin_notification_phone, ALERT_PHONE_PATTERN, 'Telefono de alertas');
      if (!MODELS.has(next.model_selection)) throw new ConfigInputError('Modelo no permitido');
      if (!VISUAL_PROVIDERS.has(next.visual_render_provider)) throw new ConfigInputError('Proveedor visual no permitido');

      if (next.facebook_ad_account_id) {
        const conflict = await findConflictingTenantForExtendedField(
          supabase,
          tenant.tenantId,
          'facebook_ad_account_id',
          next.facebook_ad_account_id,
        );
        if (conflict) return NextResponse.json({ error: 'Esta cuenta publicitaria ya esta vinculada' }, { status: 409 });
      }
      if (next.facebook_page_id) {
        const conflict = await findConflictingTenantForExtendedField(
          supabase,
          tenant.tenantId,
          'facebook_page_id',
          next.facebook_page_id,
        );
        if (conflict) return NextResponse.json({ error: 'Esta pagina de Facebook ya esta vinculada' }, { status: 409 });
      }
      if (next.bulk_wa_phone_id) {
        const conflict = await findConflictingTenantForExtendedField(
          supabase,
          tenant.tenantId,
          'bulk_wa_phone_id',
          next.bulk_wa_phone_id,
        );
        if (conflict) return NextResponse.json({ error: 'Este número de WhatsApp masivo ya está vinculado' }, { status: 409 });
      }
      updateData.openai_key = encodeExtendedConfig(next);
    }

    if (body.whatsapp_phone_id !== undefined) {
      const phoneId = inputString(body.whatsapp_phone_id, 30);
      assertPattern(phoneId, PHONE_ID_PATTERN, 'Phone ID de WhatsApp');
      if (phoneId) {
        const { data: conflict, error: conflictError } = await supabase
          .from('config')
          .select('tenant_id')
          .eq('whatsapp_phone_id', phoneId)
          .neq('tenant_id', tenant.tenantId)
          .maybeSingle();
        if (conflictError) {
          console.error('WhatsApp identity lookup failed:', conflictError.code || 'database_error');
          return internalApiError();
        }
        if (conflict) return NextResponse.json({ error: 'Este numero de WhatsApp ya esta vinculado' }, { status: 409 });
      }
      updateData.whatsapp_phone_id = phoneId || null;
    }
    if (body.payphone_store_id !== undefined) {
      updateData.payphone_store_id = inputString(body.payphone_store_id, 200) || null;
    }
    if (body.ai_prompt !== undefined) updateData.ai_prompt = inputString(body.ai_prompt, 40_000);
    if (body.media_retention_days !== undefined) {
      const retention = updatedNumber(body.media_retention_days, 0, 0, 3_650);
      if (!Number.isSafeInteger(retention)) throw new ConfigInputError('Retencion invalida');
      updateData.media_retention_days = retention;
    }
    if (body.whatsapp_token !== undefined) {
      updateData.whatsapp_token = updatedSecret(body.whatsapp_token, storedString(existing?.whatsapp_token, 8_192)) || null;
    }
    if (body.payphone_token !== undefined) {
      updateData.payphone_token = updatedSecret(body.payphone_token, storedString(existing?.payphone_token, 8_192)) || null;
    }

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json({ error: 'No hay campos reconocidos para actualizar' }, { status: 400 });
    }

    // Use explicit INSERT/UPDATE instead of upsert to guarantee strict
    // tenant isolation. upsert(onConflict:'tenant_id') silently falls back
    // to INSERT when no UNIQUE constraint exists, creating duplicate rows.
    let writeError;
    let savedConfig: { whatsapp_token: string | null; whatsapp_phone_id: string | null } | null = null;
    if (existing) {
      // Row exists for this tenant: UPDATE only that row.
      const { data, error } = await supabase
        .from('config')
        .update(updateData)
        .eq('tenant_id', tenant.tenantId)
        .select('whatsapp_token,whatsapp_phone_id')
        .single();
      writeError = error;
      savedConfig = data;
    } else {
      // No row yet: INSERT a brand-new isolated row for this tenant.
      const { data, error } = await supabase
        .from('config')
        .insert({ tenant_id: tenant.tenantId, ...updateData })
        .select('whatsapp_token,whatsapp_phone_id')
        .single();
      writeError = error;
      savedConfig = data;
    }
    if (writeError) {
      console.error('[Config] Write failed:', writeError);
      if (writeError.code === '23505') return NextResponse.json({ error: 'La conexion ya esta vinculada' }, { status: 409 });
      return internalApiError();
    }
    if (!savedConfig) {
      console.error('[Config] Write returned no tenant row');
      return internalApiError();
    }
    return NextResponse.json(
      {
        success: true,
        message: 'Configuracion guardada correctamente',
        whatsapp_token_configured: Boolean(savedConfig.whatsapp_token),
        whatsapp_phone_id: storedString(savedConfig.whatsapp_phone_id, 30),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof ConfigInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[Config] Mutation failed with exception:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `No se pudo completar la solicitud (Exception): ${msg}` }, { status: 500 });
  }
}
