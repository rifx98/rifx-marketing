import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PUBLIC_UPLOAD_PATH = /^announcements\/[0-9]{10,17}_[a-zA-Z0-9_-]{6,64}\.(?:jpe?g|png|webp|gif)$/;
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

interface AssetRouteContext {
  params: Promise<{ path: string[] }>;
}

// The uploads bucket is private. Only immutable, admin-created marketing
// images under announcements/ are intentionally exposed through this route.
export async function GET(_request: Request, context: AssetRouteContext) {
  const { path: pathSegments } = await context.params;
  const objectPath = Array.isArray(pathSegments) ? pathSegments.join('/') : '';

  if (!PUBLIC_UPLOAD_PATH.test(objectPath)) {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.storage.from('uploads').download(objectPath);
  if (error || !data) {
    if (error) console.error('Public asset lookup failed:', error.name || 'storage_error');
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const extension = objectPath.slice(objectPath.lastIndexOf('.') + 1).toLowerCase();
  return new NextResponse(data, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Type': CONTENT_TYPES[extension] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
