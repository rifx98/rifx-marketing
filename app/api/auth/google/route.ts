import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { signToken, PLAN_LIMITS } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Token de Google requerido' }, { status: 400 });
    }

    // Verify token using Google secure tokeninfo endpoint
    const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const googleRes = await fetch(googleVerifyUrl);
    
    if (!googleRes.ok) {
      const errorData = await googleRes.json();
      return NextResponse.json({ error: errorData.error_description || 'Token de Google inválido' }, { status: 401 });
    }

    const payload = await googleRes.json();
    const email = payload.email?.toLowerCase().trim();
    const name = payload.name || '';
    const givenName = payload.given_name || name;

    if (!email) {
      return NextResponse.json({ error: 'No se pudo obtener el correo de Google' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Check if tenant already exists
    let { data: tenant, error: selectError } = await supabase
      .from('tenants')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (selectError) {
      console.error('❌ Error buscando tenant de Google:', selectError);
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    if (!tenant) {
      // Create new tenant automatically (Google Registration)
      const trialLimits = PLAN_LIMITS.trial;
      const { data: newTenant, error: insertError } = await supabase
        .from('tenants')
        .insert({
          email,
          password_hash: '', // No password hash for OAuth users
          company_name: `${givenName} Workspaces`,
          owner_name: name,
          plan: 'trial',
          plan_status: 'active',
          plan_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days trial
          storage_limit_bytes: trialLimits.storage,
          contact_limit: trialLimits.contacts,
          is_admin: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error registrando tenant de Google:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      tenant = newTenant;

      // Create default config for this tenant
      await supabase.from('config').insert({
        tenant_id: tenant.id,
        ai_prompt: 'Eres un asesor de ventas profesional. Tu objetivo es ayudar al cliente y cerrar ventas. Sé amigable, persuasivo y responde en español.',
      });

      console.log('✅ Nuevo tenant registrado vía Google:', tenant.email);
    } else {
      // Verify/refresh plan expiration
      const isExpired = tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date();
      if (isExpired) {
        if (tenant.plan_status === 'active' || tenant.plan_status === null) {
          if (tenant.pending_plan) {
            const LIMITS: Record<string, { contacts: number; storage: number }> = {
              trial: { contacts: 200, storage: 100*1024*1024 },
              start: { contacts: 1000, storage: 250*1024*1024 },
              advanced: { contacts: 10000, storage: 500*1024*1024 },
              plus: { contacts: 20000, storage: 1024*1024*1024 },
              master: { contacts: 50000, storage: 2048*1024*1024 },
            };
            const newPlan = tenant.pending_plan;
            const limits = LIMITS[newPlan] || LIMITS.trial;
            const { data: updatedTenant } = await supabase.from('tenants').update({
              plan: newPlan,
              plan_status: 'active',
              plan_started_at: new Date().toISOString(),
              plan_expires_at: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
              storage_limit_bytes: limits.storage,
              contact_limit: limits.contacts,
              pending_plan: null,
            }).eq('id', tenant.id).select().single();
            
            if (updatedTenant) {
              tenant = updatedTenant;
            }
            console.log(`🔄 Auto-activado upgrade programado vía Google: ${newPlan}`);
          } else {
            const { data: updatedTenant } = await supabase.from('tenants').update({ plan_status: 'expired' }).eq('id', tenant.id).select().single();
            if (updatedTenant) {
              tenant = updatedTenant;
            }
          }
        } else if (tenant.plan_status === 'cancelled') {
          // Cancelled plan has now expired -> Downgrade to trial!
          const { data: updatedTenant } = await supabase.from('tenants').update({
            plan: 'trial',
            plan_status: 'expired',
            plan_expires_at: null,
            contact_limit: 200,
            storage_limit_bytes: 100 * 1024 * 1024,
            pending_plan: null,
          }).eq('id', tenant.id).select().single();
          if (updatedTenant) {
            tenant = updatedTenant;
          }
        }
      }
      console.log('✅ Login exitoso vía Google:', tenant.email);
    }

    // Generate JWT token
    const token = await signToken({
      tenantId: tenant.id,
      email: tenant.email,
      plan: tenant.plan,
      isAdmin: tenant.is_admin,
      adminRole: tenant.admin_role || 'full',
      adminCanEditPlans: tenant.admin_can_edit_plans !== false,
    });

    // Fetch global plan permissions from platform_settings
    let planPermissions: any = {
      trial: ["dashboard", "settings", "billing"],
      start: ["dashboard", "crm", "settings", "billing", "playground"],
      advanced: ["dashboard", "crm", "settings", "billing", "playground", "banners", "segments"],
      plus: ["dashboard", "crm", "settings", "billing", "playground", "banners", "segments", "analytics"],
      master: ["dashboard", "crm", "settings", "billing", "playground", "campaigns", "banners", "segments", "analytics"]
    };

    try {
      const { data: settingsData } = await supabase
        .from('platform_settings')
        .select('plan_permissions')
        .limit(1)
        .maybeSingle();
      if (settingsData?.plan_permissions) {
        planPermissions = settingsData.plan_permissions;
      }
    } catch (e) {
      console.warn("Could not load plan_permissions from database, using defaults:", e);
    }

    const userPlan = tenant.plan || 'trial';
    const baseAllowedTabs = planPermissions[userPlan] || planPermissions.trial;
    const overrides = tenant.permission_overrides || {};
    const activeOverrides: string[] = [];
    const now = Date.now();

    for (const [tab, expiry] of Object.entries(overrides)) {
      if (expiry) {
        const expiryDate = new Date(expiry as string);
        if (!isNaN(expiryDate.getTime()) && expiryDate.getTime() > now) {
          activeOverrides.push(tab);
        }
      }
    }

    const allowedTabsSet = new Set([...baseAllowedTabs, ...activeOverrides]);
    if (tenant.is_admin) {
      allowedTabsSet.add('admin');
    }
    allowedTabsSet.add('dashboard');
    allowedTabsSet.add('billing');

    const allowedTabs = Array.from(allowedTabsSet);

    return NextResponse.json({
      success: true,
      token,
      tenant: {
        id: tenant.id,
        email: tenant.email,
        companyName: tenant.company_name,
        ownerName: tenant.owner_name,
        plan: tenant.plan,
        planStatus: tenant.plan_status,
        planStartedAt: tenant.plan_started_at,
        planExpiresAt: tenant.plan_expires_at,
        pendingPlan: tenant.pending_plan || null,
        storageLimitBytes: tenant.storage_limit_bytes,
        storageUsedBytes: tenant.storage_used_bytes,
        contactLimit: tenant.contact_limit,
        isAdmin: tenant.is_admin,
        adminRole: tenant.admin_role || 'full',
        createdAt: tenant.created_at,
        allowedTabs,
        permissionOverrides: overrides,
      },
    });
  } catch (error: any) {
    console.error('❌ Error en autenticación de Google:', error);
    return NextResponse.json({ error: error?.message || 'Error interno del servidor' }, { status: 500 });
  }
}
