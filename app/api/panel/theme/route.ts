import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';
import {
  enforceTenantRateLimit,
  internalApiError,
  readLimitedJsonObject,
} from '@/lib/request-guards';

const COLOR_KEYS = [
  'primary', 'secondary', 'accent', 'link', 'cardBg', 'sidebarBg', 'bg',
  'text', 'textSecondary', 'border', 'hover', 'success', 'warning', 'danger',
] as const;
const VALID_FONTS = new Set(['Inter', 'Poppins', 'Montserrat']);
const VALID_RADII = new Set(['square', 'semi', 'rounded']);
const VALID_MODES = new Set(['light', 'dark', 'auto']);

function normalizeTheme(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const theme = value as Record<string, unknown>;
  const colors = theme.colors;
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) return null;
  const rawColors = colors as Record<string, unknown>;
  const normalizedColors: Record<string, string> = {};
  for (const key of COLOR_KEYS) {
    const color = rawColors[key];
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return null;
    normalizedColors[key] = color.toUpperCase();
  }
  if (
    typeof theme.preset !== 'string'
    || !/^[a-z0-9_-]{1,64}$/i.test(theme.preset)
    || typeof theme.font !== 'string'
    || !VALID_FONTS.has(theme.font)
    || typeof theme.borderRadius !== 'string'
    || !VALID_RADII.has(theme.borderRadius)
    || typeof theme.mode !== 'string'
    || !VALID_MODES.has(theme.mode)
    || typeof theme.dynamicSidebar !== 'boolean'
  ) return null;
  return {
    preset: theme.preset,
    colors: normalizedColors,
    font: theme.font,
    borderRadius: theme.borderRadius,
    mode: theme.mode,
    dynamicSidebar: theme.dynamicSidebar,
  };
}

// GET: Obtener configuración de tema
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const rateDenied = await enforceTenantRateLimit('theme-read', tenant.tenantId, 120, 60_000);
    if (rateDenied) return rateDenied;

    const supabase = createSupabaseAdmin();

    const { data: config, error } = await supabase
      .from('config')
      .select('theme_config')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();

    if (error) {
      // If theme_config column doesn't exist yet, return empty
      if (error.message?.includes('theme_config') || error.code === '42703') {
        return NextResponse.json({});
      }
      console.error('Theme lookup failed:', error.code || 'database_error');
      return internalApiError();
    }

    if (!config || !config.theme_config) {
      return NextResponse.json({});
    }

    try {
      const themeData: unknown = typeof config.theme_config === 'string'
        ? JSON.parse(config.theme_config)
        : config.theme_config;
      return NextResponse.json(normalizeTheme(themeData) || {});
    } catch {
      return NextResponse.json({});
    }
  } catch {
    console.error('Theme request failed');
    return internalApiError();
  }
}

// POST: Guardar configuración de tema
export async function POST(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const rateDenied = await enforceTenantRateLimit('theme-write', tenant.tenantId, 20, 60_000);
    if (rateDenied) return rateDenied;

    const parsedBody = await readLimitedJsonObject(req, 16 * 1024);
    if (!parsedBody.ok) return parsedBody.response;
    const body = normalizeTheme(parsedBody.body);
    if (!body) return NextResponse.json({ error: 'Configuracion de tema invalida' }, { status: 400 });
    const supabase = createSupabaseAdmin();

    // Serialize theme config as JSON string
    const themeJson = JSON.stringify(body);

    // Check if config row exists
    const { data: existing, error: fetchError } = await supabase
      .from('config')
      .select('id')
      .eq('tenant_id', tenant.tenantId)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Theme configuration lookup failed:', fetchError.code || 'database_error');
      return internalApiError();
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('config')
        .update({ theme_config: themeJson, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('tenant_id', tenant.tenantId);

      if (updateError) {
        // If column doesn't exist, silently succeed (theme stored in localStorage only)
        if (updateError.message?.includes('theme_config') || updateError.code === '42703') {
          console.warn('⚠️ theme_config column not found in DB, theme saved only in localStorage');
          return NextResponse.json({ success: true, storage: 'localStorage' });
        }
        console.error('Theme update failed:', updateError.code || 'database_error');
        return internalApiError();
      }
    } else {
      const { error: insertError } = await supabase
        .from('config')
        .insert({
          tenant_id: tenant.tenantId,
          theme_config: themeJson,
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        if (insertError.message?.includes('theme_config') || insertError.code === '42703') {
          console.warn('⚠️ theme_config column not found in DB, theme saved only in localStorage');
          return NextResponse.json({ success: true, storage: 'localStorage' });
        }
        console.error('Theme insert failed:', insertError.code || 'database_error');
        return internalApiError();
      }
    }

    return NextResponse.json({ success: true, storage: 'database' });
  } catch {
    console.error('Theme mutation failed');
    return internalApiError();
  }
}
