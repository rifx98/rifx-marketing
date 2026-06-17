// ============================================
// PRICING GUARD — Protección contra precios inventados
// 3 capas: carga de precios, inyección al prompt, validación post-IA
// Solo aplica en modo servicios (NO dropi)
// ============================================

import { SupabaseClient } from '@supabase/supabase-js';

export interface PricingItem {
  id: string;
  service_name: string;
  category: string;
  description: string | null;
  base_price: number | null;
  currency: string;
  billing_type: string;
  included_items: string[];
  optional_addons: AddonItem[];
  min_price: number | null;
  max_price: number | null;
  is_custom_quote: boolean;
}

interface AddonItem {
  name: string;
  price: number;
}

// ---- CAPA 1: Cargar precios del tenant ----

export async function loadTenantPricing(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PricingItem[]> {
  try {
    const { data, error } = await supabase
      .from('service_pricing')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('service_name', { ascending: true });

    if (error) {
      console.error('💰 Pricing Guard: error cargando precios:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      service_name: row.service_name,
      category: row.category || 'general',
      description: row.description,
      base_price: row.base_price ? parseFloat(row.base_price) : null,
      currency: row.currency || 'USD',
      billing_type: row.billing_type || 'one_time',
      included_items: row.included_items || [],
      optional_addons: parseAddons(row.optional_addons),
      min_price: row.min_price ? parseFloat(row.min_price) : null,
      max_price: row.max_price ? parseFloat(row.max_price) : null,
      is_custom_quote: row.is_custom_quote ?? false,
    }));
  } catch (err) {
    console.error('💰 Pricing Guard: excepción cargando precios:', err);
    return [];
  }
}

function parseAddons(raw: any): AddonItem[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  if (Array.isArray(raw)) return raw;
  return [];
}

// ---- CAPA 2: Construir sección de prompt con precios oficiales ----

const BILLING_LABELS: Record<string, string> = {
  one_time: 'pago único',
  monthly: '/mes',
  hourly: '/hora',
  per_project: 'por proyecto',
  custom: 'según alcance',
};

const SAFE_RESPONSE_NO_PRICING =
  'Ese servicio se cotiza según el alcance del proyecto. ¿Me puedes contar qué necesitas exactamente para prepararte una cotización?';

export function buildPricingPrompt(items: PricingItem[]): string {
  if (items.length === 0) {
    // Sin precios configurados → prohibir que la IA invente cualquier precio
    return `\n\n[LISTA OFICIAL DE PRECIOS — OBLIGATORIO]:
REGLAS ESTRICTAS:
- NO tienes precios disponibles para este negocio.
- NUNCA inventes, estimes o menciones montos numéricos como precio.
- Si el cliente pregunta por precio, responde exactamente: "${SAFE_RESPONSE_NO_PRICING}"
- No digas "desde", "aproximadamente", ni "alrededor de" seguido de un monto.`;
  }

  let prompt = `\n\n[LISTA OFICIAL DE PRECIOS — OBLIGATORIO]:

REGLAS ESTRICTAS:
- Solo puedes mencionar precios que aparezcan en esta lista.
- Si el cliente pregunta por un servicio que NO está aquí, responde: "${SAFE_RESPONSE_NO_PRICING}"
- No inventes montos. No redondees. No aproximes.
- No sumes extras que no estén definidos como add-ons.
- No cambies la moneda.
- Si falta información del cliente, haz preguntas antes de cotizar.
- Si el cliente pide algo combinado, calcula SOLO con precios oficiales o indica que requiere cotización personalizada.

SERVICIOS DISPONIBLES:\n`;

  // Agrupar por categoría
  const byCategory: Record<string, PricingItem[]> = {};
  for (const item of items) {
    const cat = item.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }

  let idx = 1;
  for (const [category, services] of Object.entries(byCategory)) {
    if (Object.keys(byCategory).length > 1) {
      prompt += `\n📂 ${category.toUpperCase()}:\n`;
    }

    for (const svc of services) {
      if (svc.is_custom_quote) {
        prompt += `\n${idx}. ${svc.service_name} → Cotización personalizada (no dar precio)`;
        if (svc.description) prompt += `\n   ${svc.description}`;
        prompt += '\n';
        idx++;
        continue;
      }

      // Precio
      let priceStr = '';
      const billingLabel = BILLING_LABELS[svc.billing_type] || '';
      if (svc.base_price !== null) {
        priceStr = `$${formatPrice(svc.base_price)} ${svc.currency} (${billingLabel})`;
      } else if (svc.min_price !== null && svc.max_price !== null) {
        priceStr = `Desde $${formatPrice(svc.min_price)} hasta $${formatPrice(svc.max_price)} ${svc.currency} (${billingLabel})`;
      } else if (svc.min_price !== null) {
        priceStr = `Desde $${formatPrice(svc.min_price)} ${svc.currency} (${billingLabel})`;
      }

      prompt += `\n${idx}. ${svc.service_name} — ${priceStr}`;
      if (svc.description) prompt += `\n   ${svc.description}`;

      // Incluidos
      if (svc.included_items.length > 0) {
        prompt += `\n   Incluye: ${svc.included_items.join(', ')}`;
      }

      // Add-ons
      if (svc.optional_addons.length > 0) {
        const addonsStr = svc.optional_addons
          .map(a => `${a.name} (+$${formatPrice(a.price)})`)
          .join(', ');
        prompt += `\n   Add-ons: ${addonsStr}`;
      }

      prompt += '\n';
      idx++;
    }
  }

  return prompt;
}

function formatPrice(n: number): string {
  // 500 → "500", 500.50 → "500.50", 1000 → "1,000"
  if (Number.isInteger(n)) {
    return n.toLocaleString('en-US');
  }
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- CAPA 3: Validador post-IA ----

const SAFE_RESPONSE =
  'Para no darte un valor incorrecto, ese servicio lo revisamos según el alcance. ¿Me puedes contar qué necesitas exactamente para prepararte una cotización?';

export function validatePricingInResponse(
  response: string,
  items: PricingItem[]
): { isValid: boolean; cleanResponse: string } {
  // Construir set de todos los precios autorizados
  const authorizedPrices = new Set<number>();

  for (const item of items) {
    if (item.base_price !== null) authorizedPrices.add(item.base_price);
    if (item.min_price !== null) authorizedPrices.add(item.min_price);
    if (item.max_price !== null) authorizedPrices.add(item.max_price);

    for (const addon of item.optional_addons) {
      if (addon.price !== null && addon.price !== undefined) {
        authorizedPrices.add(addon.price);
      }
    }

    // Sumas comunes autorizadas: base + cada addon
    if (item.base_price !== null) {
      for (const addon of item.optional_addons) {
        authorizedPrices.add(item.base_price + addon.price);
      }
    }
  }

  // Extraer todos los montos de la respuesta
  // Matches: $500, $500.00, $1,200, $1,200.50, 500 USD, 1200 dólares
  const priceRegex = /\$\s*([\d,]+(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:USD|usd|dólares|dolares)/g;
  const foundPrices: number[] = [];

  let match;
  while ((match = priceRegex.exec(response)) !== null) {
    const raw = (match[1] || match[2] || '').replace(/,/g, '');
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 0) {
      foundPrices.push(num);
    }
  }

  // Si no hay precios en la respuesta, es válida
  if (foundPrices.length === 0) {
    return { isValid: true, cleanResponse: response };
  }

  // Verificar cada precio encontrado contra los autorizados
  for (const price of foundPrices) {
    if (!isPriceAuthorized(price, authorizedPrices, items)) {
      console.log(`🚫 Pricing Guard: precio no autorizado $${price} detectado en respuesta`);
      const safeResponse = items.length === 0
        ? 'Ese servicio se cotiza según el alcance del proyecto. ¿Me puedes contar qué necesitas exactamente?'
        : 'Para no darte un valor incorrecto, ese servicio lo revisamos según el alcance. ¿Me puedes contar qué necesitas exactamente para prepararte una cotización?';
      return { isValid: false, cleanResponse: safeResponse };
    }
  }

  return { isValid: true, cleanResponse: response };
}

function isPriceAuthorized(
  price: number,
  authorizedSet: Set<number>,
  items: PricingItem[]
): boolean {
  // Check 1: precio exacto en el set (incluyendo sumas base+addon)
  if (authorizedSet.has(price)) return true;

  // Check 2: formato equivalente — $500 vs $500.00
  // Normalizar: 500.00 → 500
  const normalized = Math.round(price * 100) / 100;
  const asInt = Math.round(price);
  if (price === asInt && authorizedSet.has(asInt)) return true;
  if (authorizedSet.has(normalized)) return true;

  // Check 3: dentro de un rango min-max definido
  for (const item of items) {
    if (item.min_price !== null && item.max_price !== null) {
      if (price >= item.min_price && price <= item.max_price) {
        return true;
      }
    }
  }

  return false;
}
