import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Ensures we always get a 32-byte key from the environment variable
function getEncryptionKey(): Buffer {
  const keySecret = process.env.ENCRYPTION_KEY;
  if (!keySecret) {
    throw new Error('FATAL: ENCRYPTION_KEY environment variable is not set. Add it to .env.local');
  }
  return crypto.createHash('sha256').update(keySecret).digest();
}

/**
 * Encrypts a string (e.g. OAuth token) using AES-256-GCM.
 * Returns the hex-encoded ciphertext, initialization vector (IV), and GCM authentication tag.
 */
export function encryptToken(text: string): { ciphertext: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Standard GCM IV is 12 bytes
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let ciphertext = cipher.update(text, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  
  return {
    ciphertext,
    iv: iv.toString('hex'),
    tag
  };
}

/**
 * Decrypts a ciphertext hex string using AES-256-GCM, validating the authentication tag.
 */
export function decryptToken(ciphertext: string, ivHex: string, tagHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
