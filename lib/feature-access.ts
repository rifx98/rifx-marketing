import { NextResponse } from 'next/server';
import type { TenantPayload } from '@/lib/auth';

export type PanelFeature =
  | 'crm'
  | 'playground'
  | 'banners'
  | 'social'
  | 'campaigns'
  | 'appointments'
  | 'analytics'
  | 'orders'
  | 'wa_campaigns'
  | 'flow_builder'
  | 'ai_premium'
  | 'team';

const PLAN_FEATURES: Readonly<Record<string, ReadonlySet<PanelFeature>>> = {
  trial: new Set<PanelFeature>(),
  start: new Set<PanelFeature>(['crm', 'playground', 'orders', 'team', 'flow_builder']),
  plus: new Set<PanelFeature>(['crm', 'playground', 'banners', 'social', 'appointments', 'analytics', 'orders', 'team', 'flow_builder', 'wa_campaigns']),
  master: new Set<PanelFeature>(['crm', 'playground', 'banners', 'social', 'campaigns', 'appointments', 'analytics', 'orders', 'team', 'flow_builder', 'wa_campaigns', 'ai_premium']),
};

function normalizedPlan(plan: string | undefined): string {
  return plan === 'advanced' ? 'plus' : (plan || 'trial').toLowerCase();
}

function hasLiveOverride(tenant: TenantPayload, feature: PanelFeature, now: number): boolean {
  const expiresAt = tenant.permissionOverrides?.[feature];
  if (typeof expiresAt !== 'string') return false;
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp > now;
}

export function tenantCanUseFeature(
  tenant: TenantPayload,
  feature: PanelFeature,
  now = Date.now(),
): boolean {
  if (tenant.isAdmin === true) return true;

  // Billing events are the source of truth. A cancelled subscription keeps
  // access only through its provider-confirmed paid grace period.
  const expiresAt = tenant.planExpiresAt ? Date.parse(tenant.planExpiresAt) : null;
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= now)) return false;
  const activeStatus = tenant.planStatus === 'active';
  const paidGracePeriod = tenant.planStatus === 'cancelled' && expiresAt !== null && expiresAt > now;
  if (!activeStatus && !paidGracePeriod) return false;

  if (hasLiveOverride(tenant, feature, now)) return true;
  return PLAN_FEATURES[normalizedPlan(tenant.plan)]?.has(feature) === true;
}

export function denyUnlessFeature(
  tenant: TenantPayload,
  feature: PanelFeature,
): NextResponse | null {
  if (tenantCanUseFeature(tenant, feature)) return null;
  return NextResponse.json(
    { error: 'Tu plan activo no incluye esta función' },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
}
