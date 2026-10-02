import { createClient } from '@supabase/supabase-js';
import dns from 'node:dns';

try {
  dns.setDefaultResultOrder?.('ipv4first');
} catch {}

const customFetch: typeof fetch = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

// Cliente para uso en el servidor (rutas API) — tiene acceso completo
export function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    global: { fetch: customFetch },
  });
}

// Cliente para uso en el navegador (panel) — acceso limitado
export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: customFetch },
  });
}
