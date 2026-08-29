import { createHash, timingSafeEqual } from 'node:crypto';

/** Stable sentinel returned to the browser instead of a stored credential. */
export const SECRET_PLACEHOLDER = '__RIFX_SECRET_CONFIGURED__';

export function redactSecret(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function resolveSecretUpdate(input: unknown, currentValue: string): string {
  if (input === undefined || input === SECRET_PLACEHOLDER) return currentValue;
  return typeof input === 'string' ? input.trim() : currentValue;
}

/** Constant-time comparison without leaking whether the inputs have equal length. */
export function safeEqualSecrets(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  const leftDigest = createHash('sha256').update(left, 'utf8').digest();
  const rightDigest = createHash('sha256').update(right, 'utf8').digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Length-first password policy. bcrypt only consumes the first 72 UTF-8 bytes,
 * so longer input is rejected instead of silently truncating it.
 */
export function validatePassword(password: unknown, email?: string): string | null {
  if (typeof password !== 'string') return 'La contraseña es requerida';
  if (password.length < 12) return 'La contraseña debe tener al menos 12 caracteres';
  if (Buffer.byteLength(password, 'utf8') > 72) return 'La contraseña no puede superar 72 bytes';

  const normalized = password.trim().toLowerCase();
  const common = new Set([
    'password1234',
    'contraseña123',
    'qwertyuiop12',
    '123456789012',
    'rifx2026rifx',
  ]);
  if (common.has(normalized)) return 'Elige una contraseña menos predecible';

  const emailLocalPart = normalizeEmail(email).split('@')[0];
  if (emailLocalPart.length >= 4 && normalized.includes(emailLocalPart)) {
    return 'La contraseña no debe contener tu correo';
  }
  return null;
}

export function getClientIp(headers: Headers): string {
  const candidate =
    headers.get('x-vercel-forwarded-for') ||
    headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for') ||
    'unknown';
  return candidate.split(',')[0]?.trim().slice(0, 128) || 'unknown';
}

export function rateLimitKey(namespace: string, identifier: string): string {
  const digest = createHash('sha256').update(identifier, 'utf8').digest('hex');
  return `${namespace}:${digest}`;
}
