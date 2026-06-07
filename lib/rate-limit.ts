// ============================================
// RATE LIMITER
// Sliding/Fixed window rate limiter for auth endpoints.
// Supports Upstash Redis with dynamic HTTP fetch fallback to in-memory.
// ============================================

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const localStore = new Map<string, RateLimitRecord>();

// Clean up expired entries every 5 minutes to prevent memory leaks in dev
if (typeof global !== 'undefined') {
  const globalAny = global as any;
  if (!globalAny.__rateLimitCleanupInterval) {
    globalAny.__rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      localStore.forEach((record, key) => {
        if (now > record.resetAt) {
          localStore.delete(key);
        }
      });
    }, 5 * 60 * 1000);
  }
}

/**
 * Check if a request is within rate limits.
 * Supports Upstash Redis HTTP API with a fallback to in-memory store if credentials are not configured.
 * @param key - Unique identifier (e.g., IP address or email)
 * @param maxAttempts - Max attempts allowed within the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed, remaining, retryAfterMs }
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const now = Date.now();
      const windowIndex = Math.floor(now / windowMs);
      const baseUrl = upstashUrl.startsWith('http') ? upstashUrl : `https://${upstashUrl}`;
      const redisKey = `ratelimit:${key}:${windowIndex}`;
      const ttlSeconds = Math.ceil(windowMs / 1000);

      // Use Upstash pipeline endpoint to increment and expire in a single HTTP roundtrip
      const response = await fetch(`${baseUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['EXPIRE', redisKey, ttlSeconds],
        ]),
        // Short timeout for safety
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data[0] && typeof data[0].result === 'number') {
          const count = data[0].result;
          const remaining = Math.max(0, maxAttempts - count);
          const allowed = count <= maxAttempts;
          
          // Calculate retryAfterMs
          const currentWindowEnd = (windowIndex + 1) * windowMs;
          const retryAfterMs = allowed ? 0 : Math.max(0, currentWindowEnd - now);

          return { allowed, remaining, retryAfterMs };
        }
      }
      console.warn('⚠️ Upstash Redis response invalid or not OK, falling back to local memory store');
    } catch (err) {
      console.error('❌ Upstash Redis error:', err);
      console.warn('⚠️ Falling back to local memory store');
    }
  }

  // FALLBACK: In-memory store (for development)
  const now = Date.now();
  const record = localStore.get(key);

  // First request or window expired → reset
  if (!record || now > record.resetAt) {
    localStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterMs: 0 };
  }

  // Within window but under limit
  if (record.count < maxAttempts) {
    record.count++;
    return { allowed: true, remaining: maxAttempts - record.count, retryAfterMs: 0 };
  }

  // Rate limited
  return { allowed: false, remaining: 0, retryAfterMs: record.resetAt - now };
}

// Auth-specific presets
export const AUTH_RATE_LIMITS = {
  login: { maxAttempts: 5, windowMs: 60 * 1000 },      // 5 attempts per minute
  register: { maxAttempts: 3, windowMs: 60 * 1000 },    // 3 registrations per minute
} as const;
