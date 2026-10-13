import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { assertSafeRemoteUrl } from '@/lib/safe-fetch';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenantFromRequest(req);
    if (!tenant?.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');
    const filename = searchParams.get('filename') || 'banner.png';

    if (!targetUrl) {
      return NextResponse.json({ error: 'Falta parámetro url' }, { status: 400 });
    }

    // Validación SSRF
    await assertSafeRemoteUrl(targetUrl);

    const remoteRes = await fetch(targetUrl);
    if (!remoteRes.ok) {
      return NextResponse.json(
        { error: `Error al obtener recurso: ${remoteRes.statusText}` },
        { status: remoteRes.status }
      );
    }

    const contentType = remoteRes.headers.get('content-type') || 'application/octet-stream';
    const buffer = await remoteRes.arrayBuffer();

    // Sanitizar nombre de archivo para la cabecera Content-Disposition
    const cleanFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${cleanFilename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[Download Proxy Error]:', err);
    return NextResponse.json({ error: err.message || 'Error en descarga' }, { status: 500 });
  }
}
