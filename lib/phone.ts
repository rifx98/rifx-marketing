/**
 * Phone validation and normalization utilities
 */

/**
 * Normalize phone number to E.164 format (+593984123456)
 * Supports common Ecuador formats:
 * - 0984123456 → +593984123456
 * - 984123456 → +593984123456
 * - +593984123456 → +593984123456
 * - 593984123456 → +593984123456
 */
export function normalizePhoneNumber(phone: string, defaultCountryCode = '593'): string | null {
  if (!phone || typeof phone !== 'string') return null;

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');

  // If starts with +, validate it
  if (cleaned.startsWith('+')) {
    // Must be at least +1234567890 (11 chars minimum)
    if (cleaned.length >= 11) {
      return cleaned;
    }
    return null;
  }

  // If starts with country code without +, add it
  if (cleaned.startsWith(defaultCountryCode)) {
    return `+${cleaned}`;
  }

  // Otherwise, add default country code
  // Validate it looks like a mobile number (9 digits for Ecuador after code)
  if (cleaned.length >= 9 && cleaned.length <= 10) {
    return `+${defaultCountryCode}${cleaned}`;
  }

  return null;
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Número de teléfono es requerido' };
  }

  const normalized = normalizePhoneNumber(phone);

  if (!normalized) {
    return { valid: false, error: 'Formato de teléfono inválido. Usa formato: 0984123456 o +593984123456' };
  }

  // Must start with +
  if (!normalized.startsWith('+')) {
    return { valid: false, error: 'El número debe incluir código de país (+593)' };
  }

  // Must be between 11-15 characters (E.164 standard)
  if (normalized.length < 11 || normalized.length > 15) {
    return { valid: false, error: 'Longitud de número inválida' };
  }

  return { valid: true };
}

/**
 * Format phone number for display
 * +593984123456 → +593 98 412 3456
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';

  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return phone;

  // Format Ecuador numbers: +593 98 412 3456
  if (normalized.startsWith('+593')) {
    const local = normalized.slice(4); // Remove +593
    if (local.length === 9) {
      return `+593 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
    }
  }

  // Default: +XX XXX XXX XXXX
  const country = normalized.slice(0, normalized.length - 10);
  const area = normalized.slice(-10, -7);
  const prefix = normalized.slice(-7, -4);
  const line = normalized.slice(-4);

  return `${country} ${area} ${prefix} ${line}`;
}

/**
 * Mask phone number for security
 * +593984123456 → +593***3456
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '';

  const normalized = normalizePhoneNumber(phone);
  if (!normalized || normalized.length < 8) return '***';

  const visibleStart = normalized.slice(0, 4);
  const visibleEnd = normalized.slice(-4);
  const maskedLength = normalized.length - 8;

  return `${visibleStart}${'*'.repeat(Math.max(3, maskedLength))}${visibleEnd}`;
}
