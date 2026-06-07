import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// ============================================
// CONFIGURACIÓN DEL BOT (APIs & Prompt)
// ============================================

// Helper: encode multiple AI keys + extra fields into a single JSON string for storage
function encodeExtendedConfig(fields: {
  openai_key: string; gemini_key: string; groq_key: string;
  alert_email: string; bulk_wa_token: string; bulk_wa_phone_id: string;
  model_selection?: string; confidence_threshold?: number; auto_classification?: boolean;
  fal_key?: string; visual_render_provider?: string;
  facebook_access_token?: string; facebook_ad_account_id?: string; facebook_page_id?: string;
  dropi_enabled?: boolean; dropi_token?: string; dropi_default_product_id?: string; dropi_default_price?: number;
}): string {
  return JSON.stringify(fields);
}

interface ExtendedConfig {
  openai_key: string; gemini_key: string; groq_key: string;
  alert_email: string; bulk_wa_token: string; bulk_wa_phone_id: string;
  model_selection: string; confidence_threshold: number; auto_classification: boolean;
  fal_key: string; visual_render_provider: string;
  facebook_access_token: string; facebook_ad_account_id: string; facebook_page_id: string;
  dropi_enabled: boolean;
  dropi_token: string;
  dropi_default_product_id: string;
  dropi_default_price: number;
}

// Helper: decode AI keys + extra fields from the stored value (handles both legacy plain string and new JSON format)
function decodeExtendedConfig(stored: string): ExtendedConfig {
  const defaults: ExtendedConfig = {
    openai_key: '', gemini_key: '', groq_key: '', alert_email: '',
    bulk_wa_token: '', bulk_wa_phone_id: '',
    model_selection: 'gpt-4o', confidence_threshold: 0.85, auto_classification: true,
    fal_key: '', visual_render_provider: 'flux',
    facebook_access_token: '', facebook_ad_account_id: '', facebook_page_id: '',
    dropi_enabled: false,
    dropi_token: '',
    dropi_default_product_id: '',
    dropi_default_price: 50,
  };
  if (!stored) return defaults;
  try {
    const parsed = JSON.parse(stored);
    return {
      openai_key: parsed.openai_key || '',
      gemini_key: parsed.gemini_key || '',
      groq_key: parsed.groq_key || '',
      alert_email: parsed.alert_email || '',
      bulk_wa_token: parsed.bulk_wa_token || '',
      bulk_wa_phone_id: parsed.bulk_wa_phone_id || '',
      model_selection: parsed.model_selection || 'gpt-4o',
      confidence_threshold: parsed.confidence_threshold ?? 0.85,
      auto_classification: parsed.auto_classification ?? true,
      fal_key: parsed.fal_key || '',
      visual_render_provider: parsed.visual_render_provider || 'flux',
      facebook_access_token: parsed.facebook_access_token || '',
      facebook_ad_account_id: parsed.facebook_ad_account_id || '',
      facebook_page_id: parsed.facebook_page_id || '',
      dropi_enabled: parsed.dropi_enabled ?? false,
      dropi_token: parsed.dropi_token || '',
      dropi_default_product_id: parsed.dropi_default_product_id || '',
      dropi_default_price: parsed.dropi_default_price ?? 50,
    };
  } catch {
    // Legacy: stored value is a plain OpenAI key string
    return { ...defaults, openai_key: stored };
  }
}

const EMPTY_CONFIG = {
  whatsapp_token: '',
  whatsapp_phone_id: '',
  openai_key: '',
  gemini_key: '',
  groq_key: '',
  alert_email: '',
  bulk_wa_token: '',
  bulk_wa_phone_id: '',
  payphone_token: '',
  payphone_store_id: '',
  ai_prompt: '',
  panel_password: '',
  media_retention_days: 0,
};

// GET: Obtener configuración actual
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const tenant = await getTenantFromRequest(req);

    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: config, error } = await supabase
      .from('config')
      .select('*')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('⚠️ Error al obtener config:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!config) {
      return NextResponse.json(EMPTY_CONFIG);
    }

    // Decode AI keys and extra fields from the single stored column
    const extended = decodeExtendedConfig(config.openai_key || '');

    return NextResponse.json({
      whatsapp_token: config.whatsapp_token || '',
      whatsapp_phone_id: config.whatsapp_phone_id || '',
      openai_key: extended.openai_key,
      gemini_key: extended.gemini_key,
      groq_key: extended.groq_key,
      fal_key: extended.fal_key,
      alert_email: extended.alert_email,
      bulk_wa_token: extended.bulk_wa_token,
      bulk_wa_phone_id: extended.bulk_wa_phone_id,
      payphone_token: config.payphone_token || '',
      payphone_store_id: config.payphone_store_id || '',
      ai_prompt: config.ai_prompt || '',
      panel_password: config.panel_password || '',
      media_retention_days: config.media_retention_days || 0,
      model_selection: extended.model_selection,
      confidence_threshold: extended.confidence_threshold,
      auto_classification: extended.auto_classification,
      visual_render_provider: extended.visual_render_provider,
      facebook_access_token: extended.facebook_access_token,
      facebook_ad_account_id: extended.facebook_ad_account_id,
      facebook_page_id: extended.facebook_page_id,
      dropi_enabled: extended.dropi_enabled,
      dropi_token: extended.dropi_token,
      dropi_default_product_id: extended.dropi_default_product_id,
      dropi_default_price: extended.dropi_default_price,
    });
  } catch (error: any) {
    console.error('❌ Error obteniendo config:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

// POST: Guardar/actualizar configuración
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const supabase = createSupabaseAdmin();

    console.log('📝 Recibiendo datos para guardar config:', Object.keys(body));

    // Build update payload — only include DB-safe fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Encode AI keys + alert_email into a single column
    const hasExtendedFields = body.openai_key !== undefined || body.gemini_key !== undefined || body.groq_key !== undefined || body.alert_email !== undefined || body.bulk_wa_token !== undefined || body.bulk_wa_phone_id !== undefined || body.model_selection !== undefined || body.confidence_threshold !== undefined || body.auto_classification !== undefined || body.fal_key !== undefined || body.visual_render_provider !== undefined || body.facebook_access_token !== undefined || body.facebook_ad_account_id !== undefined || body.facebook_page_id !== undefined || body.dropi_enabled !== undefined || body.dropi_token !== undefined || body.dropi_default_product_id !== undefined || body.dropi_default_price !== undefined;
    if (hasExtendedFields) {
      // First, get existing values so we don't lose them when only one is updated
      const { data: existing } = await supabase
        .from('config')
        .select('openai_key')
        .eq('tenant_id', tenant.tenantId)
        .limit(1)
        .maybeSingle();

      const current = decodeExtendedConfig(existing?.openai_key || '');
      
      updateData.openai_key = encodeExtendedConfig({
        openai_key: body.openai_key !== undefined ? body.openai_key : current.openai_key,
        gemini_key: body.gemini_key !== undefined ? body.gemini_key : current.gemini_key,
        groq_key: body.groq_key !== undefined ? body.groq_key : current.groq_key,
        alert_email: body.alert_email !== undefined ? body.alert_email : current.alert_email,
        bulk_wa_token: body.bulk_wa_token !== undefined ? body.bulk_wa_token : current.bulk_wa_token,
        bulk_wa_phone_id: body.bulk_wa_phone_id !== undefined ? body.bulk_wa_phone_id : current.bulk_wa_phone_id,
        model_selection: body.model_selection !== undefined ? body.model_selection : current.model_selection,
        confidence_threshold: body.confidence_threshold !== undefined ? body.confidence_threshold : current.confidence_threshold,
        auto_classification: body.auto_classification !== undefined ? body.auto_classification : current.auto_classification,
        fal_key: body.fal_key !== undefined ? body.fal_key : current.fal_key,
        visual_render_provider: body.visual_render_provider !== undefined ? body.visual_render_provider : current.visual_render_provider,
        facebook_access_token: body.facebook_access_token !== undefined ? body.facebook_access_token : current.facebook_access_token,
        facebook_ad_account_id: body.facebook_ad_account_id !== undefined ? body.facebook_ad_account_id : current.facebook_ad_account_id,
        facebook_page_id: body.facebook_page_id !== undefined ? body.facebook_page_id : current.facebook_page_id,
        dropi_enabled: body.dropi_enabled !== undefined ? body.dropi_enabled : current.dropi_enabled,
        dropi_token: body.dropi_token !== undefined ? body.dropi_token : current.dropi_token,
        dropi_default_product_id: body.dropi_default_product_id !== undefined ? body.dropi_default_product_id : current.dropi_default_product_id,
        dropi_default_price: body.dropi_default_price !== undefined ? body.dropi_default_price : current.dropi_default_price,
      });
    }

    // Other safe fields that exist in the DB table
    const safeFields = ['whatsapp_token', 'whatsapp_phone_id', 'payphone_token', 'payphone_store_id', 'ai_prompt', 'panel_password', 'media_retention_days'];
    for (const field of safeFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    console.log('📝 Campos a guardar:', Object.keys(updateData));
    console.log('📝 Tenant ID:', tenant.tenantId);

    // Obtener config existente
    const { data: existingRow, error: fetchError } = await supabase
      .from('config')
      .select('id, tenant_id')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Error consultando config existente:', fetchError.message);
      return NextResponse.json({ error: `Error al consultar: ${fetchError.message}` }, { status: 500 });
    }

    if (existingRow) {
      console.log('📝 Actualizando config existente (id:', existingRow.id, ')');
      const { error: updateError } = await supabase
        .from('config')
        .update(updateData)
        .eq('id', existingRow.id)
        .eq('tenant_id', tenant.tenantId);

      if (updateError) {
        console.error('❌ Error actualizando config:', updateError.message, updateError.details, updateError.hint);
        return NextResponse.json({ error: `Error al actualizar: ${updateError.message}` }, { status: 500 });
      }
      console.log('✅ Config actualizada correctamente (id:', existingRow.id, ')');
    } else {
      // Include tenant_id on insert
      updateData.tenant_id = tenant.tenantId;
      console.log('📝 Insertando nueva config con campos:', Object.keys(updateData));
      const { error: insertError } = await supabase.from('config').insert(updateData);
      if (insertError) {
        console.error('❌ Error insertando config:', insertError.message, insertError.details, insertError.hint);
        return NextResponse.json({ error: `Error al insertar: ${insertError.message}` }, { status: 500 });
      }
      console.log('✅ Config insertada por primera vez');
    }

    return NextResponse.json({ success: true, message: 'Configuración guardada correctamente' });
  } catch (error: any) {
    console.error('❌ Error guardando config:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
