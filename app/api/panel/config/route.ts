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
}): string {
  return JSON.stringify(fields);
}

interface ExtendedConfig {
  openai_key: string; gemini_key: string; groq_key: string;
  alert_email: string; bulk_wa_token: string; bulk_wa_phone_id: string;
  model_selection: string; confidence_threshold: number; auto_classification: boolean;
}

// Helper: decode AI keys + extra fields from the stored value (handles both legacy plain string and new JSON format)
function decodeExtendedConfig(stored: string): ExtendedConfig {
  const defaults: ExtendedConfig = {
    openai_key: '', gemini_key: '', groq_key: '', alert_email: '',
    bulk_wa_token: '', bulk_wa_phone_id: '',
    model_selection: 'gpt-4o', confidence_threshold: 0.85, auto_classification: true,
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

    let query = supabase.from('config').select('*');
    if (tenant?.tenantId) {
      query = query.eq('tenant_id', tenant.tenantId);
    }
    const { data: config, error } = await query.limit(1).single();

    if (error) {
      console.error('⚠️ Error o tabla vacía al obtener config:', error.message);
      if (error.code === 'PGRST116') {
        return NextResponse.json(EMPTY_CONFIG);
      }
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
    });
  } catch (error: any) {
    console.error('❌ Error obteniendo config:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

// POST: Guardar/actualizar configuración
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createSupabaseAdmin();
    const tenant = await getTenantFromRequest(req);

    console.log('📝 Recibiendo datos para guardar config:', Object.keys(body));

    // Build update payload — only include DB-safe fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Encode AI keys + alert_email into a single column
    const hasExtendedFields = body.openai_key !== undefined || body.gemini_key !== undefined || body.groq_key !== undefined || body.alert_email !== undefined || body.bulk_wa_token !== undefined || body.bulk_wa_phone_id !== undefined || body.model_selection !== undefined || body.confidence_threshold !== undefined || body.auto_classification !== undefined;
    if (hasExtendedFields) {
      // First, get existing values so we don't lose them when only one is updated
      let existingQuery = supabase.from('config').select('openai_key');
      if (tenant?.tenantId) existingQuery = existingQuery.eq('tenant_id', tenant.tenantId);
      const { data: existing } = await existingQuery.limit(1).single();
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
    console.log('📝 Tenant ID:', tenant?.tenantId || '(sin tenant)');

    // Obtener config existente
    let fetchQuery = supabase.from('config').select('id, tenant_id');
    if (tenant?.tenantId) fetchQuery = fetchQuery.eq('tenant_id', tenant.tenantId);
    const { data: existingRow, error: fetchError } = await fetchQuery.limit(1).single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error consultando config existente:', fetchError.message);
      return NextResponse.json({ error: `Error al consultar: ${fetchError.message}` }, { status: 500 });
    }

    if (existingRow) {
      console.log('📝 Actualizando config existente (id:', existingRow.id, ')');
      const { error: updateError } = await supabase.from('config').update(updateData).eq('id', existingRow.id);
      if (updateError) {
        console.error('❌ Error actualizando config:', updateError.message, updateError.details, updateError.hint);
        return NextResponse.json({ error: `Error al actualizar: ${updateError.message}` }, { status: 500 });
      }
      console.log('✅ Config actualizada correctamente (id:', existingRow.id, ')');
    } else {
      // Include tenant_id on insert if available
      if (tenant?.tenantId) {
        updateData.tenant_id = tenant.tenantId;
      }
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
