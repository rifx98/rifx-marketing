import { NextRequest, NextResponse } from 'next/server';
import { getTenantFromRequest } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase';

export const ADMIN_SECTIONS = [
  'overview',
  'tenants',
  'templates',
  'announcements',
  'permissions',
  'ai_engine',
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

interface AdminPermissionRule {
  sections: readonly AdminSection[];
  fullOnly?: boolean;
  requiresPlanEditing?: boolean;
}

const ADMIN_PERMISSION_RULES = {
  'dashboard.read': {
    sections: ADMIN_SECTIONS,
  },
  'announcements.manage': {
    sections: ['announcements'],
  },
  'announcements.improve': {
    sections: ['announcements'],
  },
  'templates.read': {
    sections: ['templates', 'ai_engine'],
  },
  'templates.manage': {
    sections: ['templates', 'ai_engine'],
  },
  'templates.detect': {
    sections: ['templates', 'ai_engine'],
  },
  'templates.seed': {
    sections: ['templates', 'ai_engine'],
  },
  'assets.upload': {
    sections: ['announcements', 'templates', 'ai_engine'],
  },
  'tenants.plan.update': {
    sections: ['tenants'],
    requiresPlanEditing: true,
  },
  'tenants.admin.update': {
    sections: ['tenants'],
    fullOnly: true,
  },
  'plan_permissions.update': {
    // "permissions" is the current tab name. "tenants" keeps compatibility
    // with existing delegated admins created before that tab was introduced.
    sections: ['permissions', 'tenants'],
    requiresPlanEditing: true,
  },
  'tenant_overrides.update': {
    sections: ['permissions', 'tenants'],
    requiresPlanEditing: true,
  },
  'tenants.delete': {
    sections: ['tenants'],
    fullOnly: true,
  },
  'platform_settings.read': {
    sections: ['overview', 'permissions'],
  },
  'platform_settings.update': {
    sections: ['permissions'],
    fullOnly: true,
  },
} as const satisfies Record<string, AdminPermissionRule>;

export type AdminPermission = keyof typeof ADMIN_PERMISSION_RULES;

export const ADMIN_DASHBOARD_ACTION_PERMISSIONS = {
  create_announcement: 'announcements.manage',
  update_announcement: 'announcements.manage',
  delete_announcement: 'announcements.manage',
  toggle_announcement: 'announcements.manage',
  update_tenant_plan: 'tenants.plan.update',
  toggle_admin: 'tenants.admin.update',
  update_plan_permissions: 'plan_permissions.update',
  update_tenant_overrides: 'tenant_overrides.update',
  delete_tenant: 'tenants.delete',
} as const satisfies Record<string, AdminPermission>;

const KNOWN_ADMIN_SECTIONS = new Set<string>(ADMIN_SECTIONS);
const FULL_ADMIN_ROLES = new Set(['full', 'superadmin']);

export interface AdminPrincipal {
  tenantId: string;
  adminRole: string;
  adminSections: readonly AdminSection[];
  adminCanEditPlans: boolean;
  hasFullAccess: boolean;
}

export type AdminAuthorization =
  | { ok: true; admin: AdminPrincipal }
  | { ok: false; response: NextResponse };

function normalizeAdminRole(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeAdminSections(value: unknown): AdminSection[] {
  let rawValue = value;
  if (typeof rawValue === 'string') {
    try {
      rawValue = JSON.parse(rawValue);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rawValue)) return [];

  return Array.from(new Set(
    rawValue
      .filter((section): section is string => typeof section === 'string')
      .map(section => section.trim().toLowerCase())
      .filter(section => KNOWN_ADMIN_SECTIONS.has(section)),
  )) as AdminSection[];
}

function deny(status: 401 | 403): AdminAuthorization {
  return {
    ok: false,
    response: NextResponse.json(
      { error: status === 401 ? 'No autorizado' : 'Permisos insuficientes' },
      { status, headers: { 'Cache-Control': 'no-store' } },
    ),
  };
}

export function hasAdminSection(admin: AdminPrincipal, section: AdminSection): boolean {
  return admin.hasFullAccess || admin.adminSections.includes(section);
}

export function hasAdminPermission(
  admin: AdminPrincipal,
  permission: AdminPermission,
): boolean {
  if (admin.hasFullAccess) return true;

  const rule: AdminPermissionRule = ADMIN_PERMISSION_RULES[permission];
  if (rule.fullOnly) return false;
  if (rule.requiresPlanEditing && !admin.adminCanEditPlans) return false;
  return rule.sections.some(section => admin.adminSections.includes(section));
}

export function getDashboardAdminPermission(action: unknown): AdminPermission | null {
  if (
    typeof action !== 'string' ||
    !Object.prototype.hasOwnProperty.call(ADMIN_DASHBOARD_ACTION_PERMISSIONS, action)
  ) {
    return null;
  }
  return ADMIN_DASHBOARD_ACTION_PERMISSIONS[
    action as keyof typeof ADMIN_DASHBOARD_ACTION_PERMISSIONS
  ];
}

export async function requireAdminPermission(
  req: NextRequest,
  permission: AdminPermission,
): Promise<AdminAuthorization> {
  const authenticatedTenant = await getTenantFromRequest(req);
  if (!authenticatedTenant?.tenantId) return deny(401);

  const supabase = createSupabaseAdmin();
  const { data: liveTenant, error } = await supabase
    .from('tenants')
    .select('id,is_admin,admin_role,admin_sections,admin_can_edit_plans')
    .eq('id', authenticatedTenant.tenantId)
    .maybeSingle();

  // Authorization state must be live and complete. Database/schema failures
  // intentionally fail closed instead of trusting claims from an old token.
  if (error || !liveTenant || liveTenant.is_admin !== true || authenticatedTenant.isAdmin !== true) {
    return deny(403);
  }

  const adminRole = normalizeAdminRole(
    liveTenant.admin_role ?? authenticatedTenant.adminRole ?? '',
  );
  const admin: AdminPrincipal = {
    tenantId: liveTenant.id,
    adminRole,
    adminSections: normalizeAdminSections(liveTenant.admin_sections),
    adminCanEditPlans:
      liveTenant.admin_can_edit_plans !== false &&
      authenticatedTenant.adminCanEditPlans !== false,
    hasFullAccess: FULL_ADMIN_ROLES.has(adminRole),
  };

  return hasAdminPermission(admin, permission) ? { ok: true, admin } : deny(403);
}
