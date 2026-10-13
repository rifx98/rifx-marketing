/**
 * Persistent Storage & Vault for AI Generated Banners & Videos
 * Guarantees generated images are preserved permanently across page refreshes,
 * browser restarts and sessions, keeping a history of up to 120 creative assets.
 */

export interface StoredBanner {
  id: string;
  templateId: string;
  templateName: string;
  templateIcon?: string;
  imageUrl: string;
  mediaType: 'image' | 'video';
  createdAt: number;
  expiresAt?: number;
  costTier?: string;
  packId?: string;
  metadata?: Record<string, any>;
}

const STORAGE_KEY = 'rifx_banner_history_v1';

export function getBannerHistory(): StoredBanner[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: StoredBanner[] = JSON.parse(raw);
    // Filtrar únicamente items corruptos sin imageUrl; mantener todos los válidos de forma permanente
    const valid = parsed.filter(item => item && typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0);
    return valid.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (e) {
    console.warn('[BannerHistory] Error reading localStorage:', e);
    return [];
  }
}

export function saveBannersToHistory(
  banners: Array<{
    templateId: string;
    templateName: string;
    templateIcon?: string;
    imageUrl: string;
    costTier?: string;
    mediaType?: 'image' | 'video';
    packId?: string;
    metadata?: Record<string, any>;
  }>
): StoredBanner[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getBannerHistory();
    const now = Date.now();

    const newItems: StoredBanner[] = banners
      .filter(b => !!b.imageUrl && typeof b.imageUrl === 'string')
      .map((b, idx) => ({
        id: `bhr-${now}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        templateId: b.templateId || 'tpl',
        templateName: b.templateName || 'Pancarta Publicitaria',
        templateIcon: b.templateIcon,
        imageUrl: b.imageUrl,
        mediaType: b.mediaType || 'image',
        createdAt: now,
        costTier: b.costTier,
        packId: b.packId,
        metadata: b.metadata,
      }));

    if (newItems.length === 0) return current;

    // Evitar duplicados por imageUrl
    const existingUrls = new Set(newItems.map(i => i.imageUrl));
    const merged = [...newItems, ...current.filter(i => !existingUrls.has(i.imageUrl))];

    // Mantener hasta 120 pancartas permanentes
    const trimmed = merged.slice(0, 120);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (e) {
    console.warn('[BannerHistory] Error saving to localStorage:', e);
    return [];
  }
}

export function deleteBannerFromHistory(id: string): StoredBanner[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getBannerHistory();
    const updated = current.filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return [];
  }
}

export function clearBannerHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

export function formatTimeRemaining(expiresAt: number, lang: string = 'es'): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return lang === 'en' ? 'Expired' : 'Expirado';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
