import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitKey } from '@/lib/security';

type JsonObject = Record<string, unknown>;

export type JsonBodyResult =
  | { ok: true; body: JsonObject }
  | { ok: false; response: NextResponse };

export type FormDataBodyResult =
  | { ok: true; body: FormData }
  | { ok: false; response: NextResponse };

const DEFAULT_JSON_LIMIT_BYTES = 64 * 1024;

function jsonError(message: string, status: number): JsonBodyResult {
  return {
    ok: false,
    response: NextResponse.json(
      { error: message },
      { status, headers: { 'Cache-Control': 'no-store' } },
    ),
  };
}

function formDataError(message: string, status: number): FormDataBodyResult {
  return {
    ok: false,
    response: NextResponse.json(
      { error: message },
      { status, headers: { 'Cache-Control': 'no-store' } },
    ),
  };
}

/**
 * Parse multipart form data only after bounding the actual request stream.
 * Calling request.formData() directly lets a chunked client force the runtime
 * to buffer an unbounded body before application-level file checks run.
 */
export async function readLimitedFormData(
  request: NextRequest,
  maxBytes: number,
): Promise<FormDataBodyResult> {
  const contentType = request.headers.get('content-type') || '';
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    return formDataError('Se requiere un formulario multipart', 415);
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return formDataError('El cuerpo de la solicitud es demasiado grande', 413);
  }
  if (!request.body) return formDataError('Formulario invÃ¡lido', 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return formDataError('El cuerpo de la solicitud es demasiado grande', 413);
      }
      chunks.push(value);
    }
  } catch {
    return formDataError('Formulario invÃ¡lido', 400);
  } finally {
    reader.releaseLock();
  }

  const payload = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const body = await new Response(payload, {
      headers: { 'Content-Type': contentType },
    }).formData();
    return { ok: true, body };
  } catch {
    return formDataError('Formulario invÃ¡lido', 400);
  }
}

/**
 * Read a JSON object while enforcing the limit on the actual stream. A
 * Content-Length check alone is insufficient because clients may use chunked
 * transfer encoding or provide a dishonest header.
 */
export async function readLimitedJsonObject(
  request: NextRequest,
  maxBytes = DEFAULT_JSON_LIMIT_BYTES,
): Promise<JsonBodyResult> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') return jsonError('Se requiere un cuerpo JSON', 415);

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return jsonError('El cuerpo de la solicitud es demasiado grande', 413);
  }

  if (!request.body) return jsonError('Cuerpo JSON inválido', 400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let raw = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return jsonError('El cuerpo de la solicitud es demasiado grande', 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch {
    return jsonError('Cuerpo JSON inválido', 400);
  } finally {
    reader.releaseLock();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonError('Cuerpo JSON inválido', 400);
    }
    return { ok: true, body: parsed as JsonObject };
  } catch {
    return jsonError('Cuerpo JSON inválido', 400);
  }
}

/** Fail closed in production when the distributed limiter is unavailable. */
export async function enforceTenantRateLimit(
  namespace: string,
  tenantId: string,
  maxAttempts = 20,
  windowMs = 60_000,
): Promise<NextResponse | null> {
  const result = await checkRateLimit(
    rateLimitKey(namespace, tenantId),
    maxAttempts,
    windowMs,
  );
  if (result.unavailable) {
    return NextResponse.json(
      { error: 'Control de capacidad temporalmente no disponible' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } },
    );
  }
  if (!result.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    return NextResponse.json(
      { error: 'Demasiadas solicitudes' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': String(retryAfterSeconds),
        },
      },
    );
  }
  return null;
}

export function internalApiError(): NextResponse {
  return NextResponse.json(
    { error: 'No se pudo completar la solicitud' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function readLimitedResponseJson(
  response: Response,
  maxBytes = 256 * 1024,
): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error('provider_response_too_large');
  }
  if (!response.body) throw new Error('invalid_provider_response');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let total = 0;
  let raw = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('provider_response_too_large');
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return JSON.parse(raw);
  } finally {
    reader.releaseLock();
  }
}
