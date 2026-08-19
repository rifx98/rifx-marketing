import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export class UnsafeRemoteResourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeRemoteResourceError';
  }
}

function parseIpv4(address: string): number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map(part => Number(part));
  return octets.every(value => Number.isInteger(value) && value >= 0 && value <= 255) ? octets : null;
}

export function isPrivateOrReservedIp(rawAddress: string): boolean {
  const address = rawAddress.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  const mappedIpv4 = address.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = parseIpv4(mappedIpv4 || address);
  if (ipv4) {
    const [a, b] = ipv4;
    return a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0) ||
      a >= 224;
  }
  if (isIP(address) === 6) {
    return address === '::' || address === '::1' ||
      address.startsWith('fc') || address.startsWith('fd') ||
      /^fe[89ab]/.test(address) || address.startsWith('ff') ||
      address.startsWith('2001:db8:') || address === '2001:db8::';
  }
  return true;
}

interface PinnedRemoteUrl {
  url: URL;
  address: string;
  family: 4 | 6;
}

async function resolveSafeRemoteUrl(rawUrl: string): Promise<PinnedRemoteUrl> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeRemoteResourceError('URL remota inválida');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new UnsafeRemoteResourceError('Solo se permiten URLs HTTP/HTTPS');
  }
  if (url.username || url.password) throw new UnsafeRemoteResourceError('La URL no puede contener credenciales');
  const expectedPort = url.protocol === 'https:' ? '443' : '80';
  if (url.port && url.port !== expectedPort) throw new UnsafeRemoteResourceError('Puerto remoto no permitido');

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new UnsafeRemoteResourceError('Host local no permitido');
  }

  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) throw new UnsafeRemoteResourceError('Dirección IP privada o reservada');
    return { url, address: hostname, family: isIP(hostname) as 4 | 6 };
  } else {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(item => isPrivateOrReservedIp(item.address))) {
      throw new UnsafeRemoteResourceError('El host resuelve a una red privada o reservada');
    }
    const pinned = addresses[0];
    return { url, address: pinned.address, family: pinned.family as 4 | 6 };
  }
}

export async function assertSafeRemoteUrl(rawUrl: string): Promise<URL> {
  return (await resolveSafeRemoteUrl(rawUrl)).url;
}

function normalizeImageContentType(value: string | null): string {
  const contentType = (value || '').toLowerCase().split(';')[0].trim();
  return contentType === 'image/jpg' ? 'image/jpeg' : contentType;
}

export function assertSupportedImage(buffer: Buffer, contentType: string): void {
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) throw new UnsafeRemoteResourceError('Tipo de imagen no permitido');
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const webp = buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!(png || jpeg || webp)) throw new UnsafeRemoteResourceError('La firma binaria no corresponde a una imagen permitida');
}

interface PinnedResponse {
  status: number;
  location: string | null;
  contentType: string | null;
  buffer: Buffer;
}

async function requestPinnedImage(
  resolved: PinnedRemoteUrl,
  maxBytes: number,
  timeoutMs: number,
): Promise<PinnedResponse> {
  return new Promise((resolve, reject) => {
    const { url, address, family } = resolved;
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)({
      protocol: url.protocol,
      hostname: address,
      family,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      servername: url.protocol === 'https:' ? url.hostname : undefined,
      headers: {
        Host: url.host,
        Accept: 'image/png,image/jpeg,image/webp',
        'Accept-Encoding': 'identity',
        'User-Agent': 'RIFX-Remote-Image/1.0',
      },
    }, response => {
      const status = response.statusCode || 0;
      const locationHeader = response.headers.location;
      const contentTypeHeader = response.headers['content-type'];
      const contentLengthHeader = response.headers['content-length'];
      const declaredLength = Number(Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader || 0);
      if (declaredLength > maxBytes) {
        response.destroy();
        reject(new UnsafeRemoteResourceError('La imagen remota supera el tamaño permitido'));
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;
      response.on('data', (chunk: Buffer | Uint8Array) => {
        total += chunk.byteLength;
        if (total > maxBytes) {
          response.destroy(new UnsafeRemoteResourceError('La imagen remota supera el tamaño permitido'));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.on('end', () => resolve({
        status,
        location: Array.isArray(locationHeader) ? locationHeader[0] || null : locationHeader || null,
        contentType: Array.isArray(contentTypeHeader) ? contentTypeHeader[0] || null : contentTypeHeader || null,
        buffer: Buffer.concat(chunks, total),
      }));
      response.on('error', reject);
    });
    request.setTimeout(timeoutMs, () => request.destroy(new UnsafeRemoteResourceError('La descarga remota agotó el tiempo')));
    request.on('error', reject);
    request.end();
  });
}

export async function fetchRemoteImage(
  rawUrl: string,
  options: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number } = {}
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const maxRedirects = options.maxRedirects ?? 3;
  let currentUrl = rawUrl;

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    // Resolve once, reject every private result, then connect directly to that
    // validated address while preserving the original Host/SNI. This closes
    // the DNS-rebinding window between validation and the network connection.
    const resolved = await resolveSafeRemoteUrl(currentUrl);
    const response = await requestPinnedImage(resolved, maxBytes, timeoutMs);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.location;
      if (!location || redirects === maxRedirects) throw new UnsafeRemoteResourceError('Redirección remota no permitida');
      currentUrl = new URL(location, resolved.url).toString();
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new UnsafeRemoteResourceError(`Descarga remota falló (${response.status})`);
    }

    const contentType = normalizeImageContentType(response.contentType);
    const buffer = response.buffer;
    assertSupportedImage(buffer, contentType);
    return { buffer, contentType, finalUrl: resolved.url.toString() };
  }
  throw new UnsafeRemoteResourceError('Demasiadas redirecciones');
}

export function decodeImageDataUri(input: string, maxBytes = 10 * 1024 * 1024): { buffer: Buffer; contentType: string } {
  const match = input.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) throw new UnsafeRemoteResourceError('Data URI de imagen inválido');
  const contentType = normalizeImageContentType(match[1]);
  const estimatedBytes = Math.floor(match[2].replace(/[\r\n]/g, '').length * 0.75);
  if (estimatedBytes > maxBytes) throw new UnsafeRemoteResourceError('La imagen supera el tamaño permitido');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > maxBytes) throw new UnsafeRemoteResourceError('La imagen supera el tamaño permitido');
  assertSupportedImage(buffer, contentType);
  return { buffer, contentType };
}
