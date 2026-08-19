import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { getTenantFromRequest } from '@/lib/auth';

// Runtime DDL and generic exec_sql are intentionally disabled. Schema changes
// must pass review, backup/restore checks and the versioned migration pipeline.
export async function POST(req: NextRequest) {
  const tenant = await getTenantFromRequest(req);
  if (!tenant?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({
    error: 'Las migraciones en runtime están deshabilitadas. Usa las migraciones versionadas y el runbook SECURITY_OPERATIONS.md.',
  }, { status: 410 });
}

// Read-only readiness check retained for administrators. Provider/SQL errors
// are deliberately not returned to the browser.
export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = createSupabaseAdmin();
    const tables = ['ad_campaigns', 'ad_creatives', 'ad_analytics', 'templates'];
    const entries = await Promise.all(tables.map(async table => {
      const { error } = await supabase.from(table).select('id').limit(1);
      return [table, !error] as const;
    }));
    const status = Object.fromEntries(entries);
    const response = NextResponse.json({ ready: Object.values(status).every(Boolean), tables: status });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'No se pudo verificar el esquema' }, { status: 500 });
  }
}
