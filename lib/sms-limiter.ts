/**
 * Global SMS limiter - protege el crédito gratis de Twilio
 * Límite diario de SMS para toda la aplicación
 */

interface DailyLimit {
  count: number;
  date: string; // YYYY-MM-DD
}

const DAILY_SMS_LIMIT = parseInt(process.env.DAILY_SMS_LIMIT || '20', 10); // 20 SMS/día por defecto

let dailyCounter: DailyLimit = {
  count: 0,
  date: new Date().toISOString().split('T')[0],
};

/**
 * Check if daily SMS limit has been reached
 * @returns {allowed: boolean, remaining: number, resetAt: string}
 */
export async function checkDailySmsLimit(): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: string;
}> {
  const today = new Date().toISOString().split('T')[0];

  // Reset counter si es un nuevo día
  if (dailyCounter.date !== today) {
    dailyCounter = { count: 0, date: today };
  }

  const remaining = Math.max(0, DAILY_SMS_LIMIT - dailyCounter.count);
  const allowed = dailyCounter.count < DAILY_SMS_LIMIT;

  // Calculate reset time (midnight tonight)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const resetAt = tomorrow.toISOString();

  return { allowed, remaining, resetAt };
}

/**
 * Increment daily SMS counter
 */
export function incrementDailySmsCount(): void {
  const today = new Date().toISOString().split('T')[0];

  // Reset counter si es un nuevo día
  if (dailyCounter.date !== today) {
    dailyCounter = { count: 0, date: today };
  }

  dailyCounter.count++;

  if (process.env.NODE_ENV === 'development') {
    console.log(`📊 Daily SMS count: ${dailyCounter.count}/${DAILY_SMS_LIMIT}`);
  }
}

/**
 * Get current daily SMS stats
 */
export function getDailySmsStats(): DailyLimit & { limit: number } {
  const today = new Date().toISOString().split('T')[0];

  if (dailyCounter.date !== today) {
    dailyCounter = { count: 0, date: today };
  }

  return {
    ...dailyCounter,
    limit: DAILY_SMS_LIMIT,
  };
}
