import { createSupabaseAdmin } from './supabase';

export async function logAuditAction(
  tenantId: string,
  userEmail: string,
  action: string,
  resource: string,
  details: Record<string, any> = {}
) {
  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from('audit_logs')
      .insert([
        {
          tenant_id: tenantId,
          user_email: userEmail,
          action,
          resource,
          details
        }
      ]);

    if (error) {
      console.error('Failed to write audit log:', error);
    }
  } catch (err) {
    console.error('Exception in logAuditAction:', err);
  }
}
