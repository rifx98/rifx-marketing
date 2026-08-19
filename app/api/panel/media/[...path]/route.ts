import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OBJECT_NAME_PATTERN = /^[0-9]{10,17}_[a-zA-Z0-9._-]{1,120}$/;

interface MediaRouteContext {
  params: Promise<{ path: string[] }>;
}

export async function GET(request: NextRequest, context: MediaRouteContext) {
  const tenant = await getTenantFromRequest(request);
  if (!tenant?.tenantId) {
    return new NextResponse(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const { path } = await context.params;
  if (!Array.isArray(path) || path.length !== 2 || path[0] !== tenant.tenantId || !OBJECT_NAME_PATTERN.test(path[1])) {
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const objectPath = `${tenant.tenantId}/${path[1]}`;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.storage.from('chat_media').createSignedUrl(objectPath, 300);
  if (error || !data?.signedUrl) {
    if (error) console.error('Chat media lookup failed:', error.name || 'storage_error');
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const signedUrl = new URL(data.signedUrl);
    const configuredOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
    if (signedUrl.protocol !== 'https:' || signedUrl.origin !== configuredOrigin.origin) {
      throw new Error('invalid_storage_origin');
    }
    return NextResponse.redirect(signedUrl, {
      status: 307,
      headers: {
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    console.error('Chat media signed URL was rejected');
    return new NextResponse(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
