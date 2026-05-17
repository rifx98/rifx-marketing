import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// POST: Login de tenant
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Find tenant by email
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !tenant) {
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, tenant.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 });
    }

    // Check plan expiration
    const isExpired = tenant.plan !== 'trial' && new Date(tenant.plan_expires_at) < new Date();
    if (isExpired && tenant.plan_status === 'active') {
      await supabase
        .from('tenants')
        .update({ plan_status: 'expired' })
        .eq('id', tenant.id);
      tenant.plan_status = 'expired';
    }

    // Generate JWT token
    const token = await signToken({
      tenantId: tenant.id,
      email: tenant.email,
      plan: tenant.plan,
      isAdmin: tenant.is_admin,
    });

    console.log('✅ Login exitoso:', tenant.email);

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
        planExpiresAt: tenant.plan_expires_at,
        storageLimitBytes: tenant.storage_limit_bytes,
        storageUsedBytes: tenant.storage_used_bytes,
        contactLimit: tenant.contact_limit,
        isAdmin: tenant.is_admin,
        createdAt: tenant.created_at,
      },
    });
  } catch (error: any) {
    console.error('❌ Error en login:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
