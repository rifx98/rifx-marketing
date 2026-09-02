export const globalMemoryStore = typeof global !== 'undefined' ? (global as any) : {};
if (!globalMemoryStore.__emailVerificationStore) {
  globalMemoryStore.__emailVerificationStore = new Map<string, { data: string; expiresAt: number }>();
}
const memoryStore = globalMemoryStore.__emailVerificationStore as Map<string, { data: string; expiresAt: number }>;

export function setMemoryVerification(email: string, data: string, ttlMs: number, prefix: string = 'email-verify:') {
  memoryStore.set(\\\\, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function checkMemoryStore(email: string, code: string, prefix: string = 'email-verify:'): {
  error?: string;
  status: number;
  data?: any;
} {
  const key = \\\\;
  const record = memoryStore.get(key);

  if (!record || Date.now() > record.expiresAt) {
    memoryStore.delete(key);
    return { error: 'Código expirado o no encontrado. Solicita uno nuevo.', status: 410 };
  }

  let pendingData: any;
  try {
    pendingData = JSON.parse(record.data);
  } catch {
    return { error: 'Error interno de verificación', status: 500 };
  }

  if (pendingData.code !== code) {
    return { error: 'Código incorrecto', status: 401 };
  }

  memoryStore.delete(key);
  return { status: 200, data: pendingData };
}
