export async function getEligibleTenantIds(
  supabase: any,
  requestedTenantId?: string,
): Promise<string[]> {
  let query = supabase
    .from('tenants')
    .select('id, plan_status, plan_expires_at')
    .eq('is_active', true)
    .is('deleted_at', null)
    .in('plan_status', ['active', 'cancelled'])
    .limit(requestedTenantId ? 1 : 1_000);
  if (requestedTenantId) query = query.eq('id', requestedTenantId);

  const { data, error } = await query;
  if (error) throw new Error('Eligible tenant lookup failed');
  const now = Date.now();
  return (data || [])
    .filter((tenant: any) => {
      if (tenant.plan_status === 'active') {
        return !tenant.plan_expires_at || Date.parse(tenant.plan_expires_at) > now;
      }
      return tenant.plan_status === 'cancelled'
        && Boolean(tenant.plan_expires_at)
        && Date.parse(tenant.plan_expires_at) > now;
    })
    .map((tenant: any) => tenant.id)
    .filter((id: unknown): id is string => typeof id === 'string');
}
