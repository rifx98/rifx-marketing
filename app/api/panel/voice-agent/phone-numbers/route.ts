import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';

export const dynamic = 'force-dynamic';

function getMasterTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  return twilio(accountSid, authToken);
}

/**
 * GET: Buscar números disponibles para comprar en Twilio
 * Query params: country (ej. 'US', 'MX', 'CA', 'ES'), areaCode (ej. '305', '55')
 */
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'voice_agent');
    if (featureError) return featureError;

    const client = getMasterTwilioClient();
    if (!client) {
      return NextResponse.json({
        configured: false,
        error: 'Las credenciales maestras de Twilio no están configuradas en el servidor (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).'
      }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const country = (searchParams.get('country') || 'US').toUpperCase();
    const areaCodeStr = searchParams.get('areaCode')?.trim();
    const contains = searchParams.get('contains')?.trim() || undefined;

    // Prefijos telefónicos conocidos para limpiar si el usuario ingresó el código de país en vez del área
    const DIALING_CODES: Record<string, string> = {
      EC: '593',
      CO: '57',
      MX: '52',
      PE: '51',
      CL: '56',
      AR: '54',
      BR: '55',
      PA: '507',
      CR: '506',
      DO: '1',
      PR: '1',
      GT: '502',
      SV: '503',
      HN: '504',
      BO: '591',
      PY: '595',
      UY: '598',
      VE: '58',
      ES: '34',
      US: '1',
      CA: '1'
    };

    let cleanArea = areaCodeStr ? areaCodeStr.replace(/^\+/, '') : '';
    const prefix = DIALING_CODES[country];
    if (prefix && cleanArea) {
      if (cleanArea === prefix) {
        cleanArea = '';
      } else if (cleanArea.startsWith(prefix)) {
        cleanArea = cleanArea.slice(prefix.length);
      }
    }
    const areaCode = cleanArea && /^\d+$/.test(cleanArea) ? parseInt(cleanArea, 10) : undefined;

    let available: any[] = [];
    try {
      available = await client.availablePhoneNumbers(country).local.list({
        areaCode,
        contains,
        voiceEnabled: true,
        limit: 8
      });
    } catch {
      // Si falló con areaCode específico, intentamos a nivel nacional
      if (areaCode) {
        try {
          available = await client.availablePhoneNumbers(country).local.list({
            contains,
            voiceEnabled: true,
            limit: 8
          });
        } catch {}
      }
    }

    // Si no hay locales, intentar con tollFree o mobile
    if (!available || available.length === 0) {
      try {
        available = await client.availablePhoneNumbers(country).tollFree.list({
          contains,
          voiceEnabled: true,
          limit: 8
        });
      } catch {}
    }

    if (!available || available.length === 0) {
      try {
        available = await client.availablePhoneNumbers(country).mobile.list({
          contains,
          voiceEnabled: true,
          limit: 8
        });
      } catch {}
    }

    const formattedNumbers = (available || []).map((item) => ({
      phoneNumber: item.phoneNumber,
      friendlyName: item.friendlyName,
      locality: item.locality || '',
      region: item.region || '',
      postalCode: item.postalCode || '',
      isoCountry: item.isoCountry || country
    }));

    return NextResponse.json({
      configured: true,
      country,
      numbers: formattedNumbers
    });
  } catch (err: any) {
    console.error('[voice-agent/phone-numbers] Excepción en GET:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}

/**
 * POST: Aprovisionar o liberar un número telefónico para el tenant
 */
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const featureError = denyUnlessFeature(tenant, 'voice_agent');
    if (featureError) return featureError;

    const body = await req.json();
    const { action, phoneNumber } = body;

    const client = getMasterTwilioClient();
    if (!client) {
      return NextResponse.json({
        error: 'Las credenciales maestras de Twilio no están configuradas en el servidor.'
      }, { status: 503 });
    }

    const supabase = createSupabaseAdmin();

    // 1. ACCIÓN: PROVISIONAR NÚMERO
    if (action === 'provision') {
      if (!phoneNumber || !/^\+?[1-9]\d{7,14}$/.test(phoneNumber.replace(/\s+/g, ''))) {
        return NextResponse.json({ error: 'Número telefónico inválido' }, { status: 400 });
      }

      const formattedNumber = phoneNumber.trim().replace(/\s+/g, '');

      // Verificar si el tenant ya tiene un número asignado
      const { data: currentSettings } = await supabase
        .from('voice_agent_settings')
        .select('id, twilio_phone_number, twilio_phone_sid')
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();

      if (currentSettings?.twilio_phone_number) {
        return NextResponse.json({
          error: `Ya tienes el número ${currentSettings.twilio_phone_number} asignado. Libéralo primero si deseas cambiar de número.`
        }, { status: 409 });
      }

      // Configuración de URLs de Webhook automáticas
      const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://rifx-marketing.com';
      const voiceWebhookUrl = `${appUrl}/api/webhooks/voice-call`;
      const statusCallbackUrl = `${appUrl}/api/webhooks/voice-call?tenant_id=${tenant.tenantId}`;

      // Comprar número en Twilio
      let purchased;
      try {
        purchased = await client.incomingPhoneNumbers.create({
          phoneNumber: formattedNumber,
          friendlyName: `RIFX Tenant - ${tenant.tenantId.slice(0, 8)}`,
          voiceUrl: voiceWebhookUrl,
          voiceMethod: 'POST',
          statusCallback: statusCallbackUrl,
          statusCallbackMethod: 'POST'
        });
      } catch (purchaseErr: any) {
        console.error('[voice-agent/phone-numbers] Error comprando número:', purchaseErr.message);
        if (purchaseErr.message?.includes('Trial accounts') || purchaseErr.code === 21614 || purchaseErr.code === 21422) {
          return NextResponse.json({
            error: 'Tu cuenta de Twilio está en modo prueba (Trial). En modo prueba gratuito, Twilio requiere que obtengas tu número de prueba directamente desde tu consola de Twilio (botón "Get a trial phone number") o actualices a "Pago por uso" (Upgrade) para compras automáticas por API.'
          }, { status: 403 });
        }
        return NextResponse.json({
          error: `Error al activar la línea en Twilio: ${purchaseErr.message}`
        }, { status: 400 });
      }

      // Guardar en la base de datos para este tenant
      const updateData: Record<string, any> = {
        tenant_id: tenant.tenantId,
        twilio_phone_number: purchased.phoneNumber,
        twilio_phone_sid: purchased.sid,
        inbound_enabled: true,
        outbound_enabled: true,
        updated_at: new Date().toISOString()
      };

      const { data: saved, error: dbError } = await supabase
        .from('voice_agent_settings')
        .upsert(updateData, { onConflict: 'tenant_id' })
        .select()
        .single();

      if (dbError) {
        console.error('[voice-agent/phone-numbers] Error guardando en base de datos:', dbError);
        return NextResponse.json({
          error: 'El número fue adquirido en Twilio pero ocurrió un error guardándolo en la base de datos.',
          phoneSid: purchased.sid,
          phoneNumber: purchased.phoneNumber
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: '¡Número telefónico asignado y activado exitosamente!',
        phoneNumber: purchased.phoneNumber,
        phoneSid: purchased.sid,
        friendlyName: purchased.friendlyName,
        settings: saved
      });
    }

    // 2. ACCIÓN: LIBERAR NÚMERO
    if (action === 'release') {
      const { data: settings } = await supabase
        .from('voice_agent_settings')
        .select('id, twilio_phone_number, twilio_phone_sid')
        .eq('tenant_id', tenant.tenantId)
        .maybeSingle();

      if (!settings?.twilio_phone_number) {
        return NextResponse.json({ error: 'No tienes un número asignado para liberar' }, { status: 400 });
      }

      // Si tenemos el SID de Twilio, lo eliminamos en Twilio
      if (settings.twilio_phone_sid) {
        try {
          await client.incomingPhoneNumbers(settings.twilio_phone_sid).remove();
        } catch (twilioErr: any) {
          console.warn('[voice-agent/phone-numbers] Advertencia al eliminar en Twilio:', twilioErr.message);
        }
      }

      // Limpiar en base de datos
      await supabase
        .from('voice_agent_settings')
        .update({
          twilio_phone_number: null,
          twilio_phone_sid: null,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenant.tenantId);

      return NextResponse.json({
        success: true,
        message: 'Número liberado exitosamente.'
      });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (err: any) {
    console.error('[voice-agent/phone-numbers] Excepción en POST:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
