// Distributed fixed-window limiter for authentication endpoints.

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  unavailable?: boolean;
}

const localStore = new Map<string, RateLimitRecord>();

if (typeof global !== 'undefined') {
  const globalWithLimiter = global as typeof global & { __rifxRateLimitCleanup?: NodeJS.Timeout };
  if (!globalWithLimiter.__rifxRateLimitCleanup) {
    globalWithLimiter.__rifxRateLimitCleanup = setInterval(() => {
      const now = Date.now();
      localStore.forEach((record, key) => {
        if (now > record.resetAt) localStore.delete(key);
      });
    }, 5 * 60 * 1000);
    globalWithLimiter.__rifxRateLimitCleanup.unref?.();
  }
}

export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const now = Date.now();
      const windowIndex = Math.floor(now / windowMs);
      const parsedUrl = new URL(upstashUrl.startsWith('http') ? upstashUrl : `https://${upstashUrl}`);
      if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
        throw new Error('UPSTASH_REDIS_REST_URL must use HTTPS in production');
      }
      const redisKey = `ratelimit:${key}:${windowIndex}`;
      const ttlSeconds = Math.ceil(windowMs / 1000);
      const response = await fetch(new URL('/pipeline', parsedUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['EXPIRE', redisKey, ttlSeconds],
        ]),
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && typeof data[0]?.result === 'number') {
          const count = data[0].result;
          const allowed = count <= maxAttempts;
          const currentWindowEnd = (windowIndex + 1) * windowMs;
          return {
            allowed,
            remaining: Math.max(0, maxAttempts - count),
            retryAfterMs: allowed ? 0 : Math.max(0, currentWindowEnd - now),
          };
        }
      }
      console.warn('Upstash Redis returned an invalid rate-limit response');
    } catch (error) {
      console.error('Upstash Redis rate limiter unavailable:', error instanceof Error ? error.message : 'unknown error');
    }
  }

  // Memory is not shared between serverless instances. Authentication fails
  // closed in production until the distributed limiter is healthy/configured.
  if (process.env.NODE_ENV === 'production') {
    return { allowed: false, remaining: 0, retryAfterMs: 5000, unavailable: true };
  }

  const now = Date.now();
  const record = localStore.get(key);
  if (!record || now > record.resetAt) {
    localStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterMs: 0 };
  }
  if (record.count < maxAttempts) {
    record.count += 1;
    return { allowed: true, remaining: maxAttempts - record.count, retryAfterMs: 0 };
  }
  return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, record.resetAt - now) };
}

export const AUTH_RATE_LIMITS = {
  login: { maxAttempts: 5, windowMs: 60 * 1000 },
  register: { maxAttempts: 3, windowMs: 60 * 1000 },
  google: { maxAttempts: 10, windowMs: 60 * 1000 },
  passwordChange: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  // SMS limits - MUY restrictivos para proteger crédito gratis
  otpSend: {
    maxAttempts: process.env.NODE_ENV === 'production' ? 2 : 3, // Solo 2 SMS en producción
    windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 5 * 60 * 1000 // 15 min en prod
  },
  otpVerify: { maxAttempts: 5, windowMs: 10 * 60 * 1000 },
} as const;
