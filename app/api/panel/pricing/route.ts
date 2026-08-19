import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import { denyUnlessFeature } from '@/lib/feature-access';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
} from '@/lib/request-guards';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BILLING_TYPES = new Set(['one_time', 'monthly', 'hourly', 'per_project', 'custom']);
const MAX_PRICE = 99_999_999.99;

function text(value: unknown, maxLength: number, required = false): string | null {
  if (value === undefined || value === null) return required ? null : '';
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maxLength) return null;
  return normalized;
}

function money(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_PRICE) {
    return undefined;
  }
  return Math.round(value * 100) / 100;
}

function stringList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const normalized = item.trim();
    if (!normalized || normalized.length > 200) return null;
    result.push(normalized);
  }
  return result;
}

async function authorize(req: NextRequest, namespace: string, attempts: number) {
  const tenant = await getTenantFromRequest(req);
  if (!tenant?.tenantId) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) } as const;
  }
  const featureDenied = denyUnlessFeature(tenant, 'crm');
  if (featureDenied) return { response: featureDenied } as const;
  const rateDenied = await enforceTenantRateLimit(namespace, tenant.tenantId, attempts, 60_000);
  if (rateDenied) return { response: rateDenied } as const;
  return { tenant } as const;
}

export async function GET(req: NextRequest) {
  try {
    const authorization = await authorize(req, 'pricing-read', 90);
    if ('response' in authorization) return authorization.response;

    const { data, error } = await createSupabaseAdmin()
      .from('service_pricing')
      .select('id,service_name,category,description,base_price,currency,billing_type,included_items,optional_addons,min_price,max_price,is_custom_quote,created_at,updated_at')
      .eq('tenant_id', authorization.tenant.tenantId)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('service_name', { ascending: true })
      .limit(500);

    if (error) {
      console.error('Service pricing lookup failed:', error.code || 'database_error');
      return internalApiError();
    }
    return NextResponse.json(
      { services: data || [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    console.error('Service pricing request failed');
    return internalApiError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorize(req, 'pricing-write', 30);
    if ('response' in authorization) return authorization.response;

    const parsed = await readLimitedJsonObject(req, 32 * 1024);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;

    const id = body.id === undefined ? null : text(body.id, 36, true);
    const serviceName = text(body.service_name, 160, true);
    const category = text(body.category ?? 'general', 80, true);
    const description = text(body.description, 2_000);
    const currency = text(body.currency ?? 'USD', 3, true)?.toUpperCase() || null;
    const billingType = text(body.billing_type ?? 'one_time', 20, true);
    const basePrice = money(body.base_price);
    const minPrice = money(body.min_price);
    const maxPrice = money(body.max_price);
    const includedItems = stringList(body.included_items);
    const optionalAddons = stringList(body.optional_addons);

    if (
      (id !== null && !UUID_PATTERN.test(id))
      || !serviceName
      || !category
      || description === null
      || !currency
      || !/^[A-Z]{3}$/.test(currency)
      || !billingType
      || !BILLING_TYPES.has(billingType)
      || basePrice === undefined
      || minPrice === undefined
      || maxPrice === undefined
      || (minPrice !== null && maxPrice !== null && minPrice > maxPrice)
      || includedItems === null
      || optionalAddons === null
      || (body.is_custom_quote !== undefined && typeof body.is_custom_quote !== 'boolean')
    ) {
      return NextResponse.json({ error: 'Datos del servicio invalidos' }, { status: 400 });
    }

    const record = {
      tenant_id: authorization.tenant.tenantId,
      service_name: serviceName,
      category,
      description: description || null,
      base_price: basePrice,
      currency,
      billing_type: billingType,
      included_items: includedItems,
      optional_addons: optionalAddons,
      min_price: minPrice,
      max_price: maxPrice,
      is_custom_quote: body.is_custom_quote === true,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const supabase = createSupabaseAdmin();

    if (id) {
      const { data, error } = await supabase
        .from('service_pricing')
        .update(record)
        .eq('id', id)
        .eq('tenant_id', authorization.tenant.tenantId)
        .select('id')
        .maybeSingle();
      if (error) {
        console.error('Service pricing update failed:', error.code || 'database_error');
        return internalApiError();
      }
      if (!data) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
      return NextResponse.json({ success: true, id: data.id });
    }

    const { data, error } = await supabase
      .from('service_pricing')
      .insert(record)
      .select('id')
      .single();
    if (error || !data) {
      console.error('Service pricing creation failed:', error?.code || 'invalid_result');
      return internalApiError();
    }
    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch {
    console.error('Service pricing mutation failed');
    return internalApiError();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authorization = await authorize(req, 'pricing-write', 30);
    if ('response' in authorization) return authorization.response;
    const id = req.nextUrl.searchParams.get('id');
    if (!id || !UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const { data, error } = await createSupabaseAdmin()
      .from('service_pricing')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', authorization.tenant.tenantId)
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('Service pricing deletion failed:', error.code || 'database_error');
      return internalApiError();
    }
    if (!data) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    console.error('Service pricing deletion failed');
    return internalApiError();
  }
}
