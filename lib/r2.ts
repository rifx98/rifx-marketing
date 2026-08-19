import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

const MAX_R2_KEY_LENGTH = 1_024;

/**
 * R2 keys are opaque rather than filesystem paths, but tenant ownership still
 * needs an exact namespace boundary. Reject ambiguous path-like segments so a
 * key can never be mistaken for another tenant's object by later code.
 */
export function isTenantOwnedR2Key(key: unknown, tenantId: unknown): key is string {
  if (typeof key !== 'string' || typeof tenantId !== 'string' || !tenantId) return false;
  if (!key || key.length > MAX_R2_KEY_LENGTH || /[\\\u0000-\u001f\u007f]/.test(key)) return false;
  const prefix = `${tenantId}/`;
  if (!key.startsWith(prefix)) return false;
  const relativeKey = key.slice(prefix.length);
  if (!relativeKey || relativeKey.startsWith('/') || relativeKey.endsWith('/')) return false;
  const segments = relativeKey.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

// Inicialización del cliente S3 para Cloudflare R2 (región 'auto' por especificación de R2)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || '',
  },
});

/**
 * Genera una URL firmada de subida (PUT) para que el navegador suba el archivo directamente.
 */
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  contentLength: number,
  expiresInSeconds = 900,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Genera una URL firmada de descarga (GET) para consumo temporal de APIs externas.
 */
export async function getDownloadPresignedUrl(key: string, expiresInSeconds = 7200): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}

export async function headFile(key: string) {
  return r2Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
}

/**
 * Elimina un solo archivo del bucket de R2.
 */
export async function deleteFile(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  return r2Client.send(command);
}

/**
 * Elimina múltiples archivos del bucket de R2 de forma eficiente.
 */
export async function deleteFiles(keys: string[]) {
  if (!keys || keys.length === 0) return;
  const command = new DeleteObjectsCommand({
    Bucket: bucketName,
    Delete: {
      Objects: keys.map(key => ({ Key: key })),
      Quiet: true,
    },
  });
  return r2Client.send(command);
}
