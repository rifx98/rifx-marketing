import crypto from 'node:crypto';

const PREFIX = 'fz1';

function keyFromEnv(): Buffer {
  const raw = process.env.FLOWZAP_SECRET_KEY || process.env.APP_ENCRYPTION_KEY || '';
  if (!raw) throw new Error('Falta FLOWZAP_SECRET_KEY o APP_ENCRYPTION_KEY.');
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptSecret(value: string): string {
  if (!value) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFromEnv(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptSecret(value?: string | null): string {
  if (!value) return '';
  const [prefix, ivB64, tagB64, dataB64] = value.split('.');
  if (prefix !== PREFIX || !ivB64 || !tagB64 || !dataB64) throw new Error('Secreto cifrado inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyFromEnv(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
