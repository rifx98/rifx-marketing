import type { SupabaseClient } from '@supabase/supabase-js';

export async function listTeamAgents(db: SupabaseClient, tenantId: string) {
  const { data, error } = await db
    .from('team_agents')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function upsertTeamAgent(
  db: SupabaseClient,
  tenantId: string,
  input: {
    id?: string;
    userId?: string | null;
    name: string;
    email?: string;
    role?: 'Administrador' | 'Supervisor' | 'Asesor';
    status?: 'Disponible' | 'Ocupado' | 'Desconectado';
    department?: string;
  },
) {
  if (!input.name.trim()) throw new Error('El nombre es obligatorio.');
  const row = {
    tenant_id: tenantId,
    user_id: input.userId || null,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    role: input.role || 'Asesor',
    status: input.status || 'Disponible',
    department: input.department?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await db
      .from('team_agents')
      .update(row)
      .eq('tenant_id', tenantId)
      .eq('id', input.id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Asesor no encontrado.');
    return data;
  }

  const { data, error } = await db.from('team_agents').insert(row).select('*').single();
  if (error) throw error;
  return data;
}
