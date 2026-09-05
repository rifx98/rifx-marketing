import { NextRequest, NextResponse } from 'next/server';

// These exact server-to-server endpoints cannot supply browser Origin/Referer
// headers. They enforce HMAC and/or Bearer authentication in their Route
// Handlers, so requests must reach those handlers for verification.
const CSRF_EXEMPT_SERVER_PATHS = new Set([
  '/api/whatsapp',
  '/api/cron/whatsapp',
  '/api/webhooks/lemonsqueezy',
]);

function buildPanelCsp(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''} https://accounts.google.com https://connect.facebook.net https://app.lemonsqueezy.com https://unpkg.com`,
    // The current UI contains React style attributes. Keeping style-only
    // unsafe-inline does not permit script execution; removing it requires a
    // separate mechanical CSS migration.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://accounts.google.com https://www.facebook.com https://www.payphone.app https://app.lemonsqueezy.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

/**
 * CSRF Protection for API routes
 * Validates origin header on mutating requests
 */
function validateCsrf(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Only protect API routes
  if (!pathname.startsWith('/api/')) {
    return null;
  }

  if (CSRF_EXEMPT_SERVER_PATHS.has(pathname)) {
    return null;
  }

  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return null;
  }

  // CSRF Protection: Validate origin for mutating requests (POST/PUT/DELETE/PATCH)
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  const allowedOrigins = [
    `https://${host}`,
    `http://${host}`,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
  ].filter(Boolean) as string[];

  // Check origin header first (most reliable)
  if (origin) {
    const isAllowed = allowedOrigins.some(allowed =>
      origin === allowed || origin.startsWith(allowed + '/')
    );

    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Invalid origin' },
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          }
        }
      );
    }
  }
  // Fallback to referer if no origin
  else if (referer) {
    const isAllowed = allowedOrigins.some(allowed =>
      referer.startsWith(allowed)
    );

    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Invalid referer' },
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          }
        }
      );
    }
  }
  // No origin or referer in production = reject
  else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Missing origin header' },
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        }
      }
    );
  }

  return null;
}

export function proxy(request: NextRequest) {
  // CSRF protection for API routes
  const csrfResponse = validateCsrf(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  // Original CSP logic for /panel routes
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildPanelCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);

  // Add security headers for all routes
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Cache control based on route type
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  } else {
    response.headers.set('Cache-Control', 'private, no-store');
  }

  return response;
}

export const config = {
  matcher: ['/panel/:path*', '/api/:path*'],
};
