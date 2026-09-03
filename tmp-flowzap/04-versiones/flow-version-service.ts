import type { SupabaseClient } from '@supabase/supabase-js';
import type { FlowDocument } from '../03-motor-flujos/flow-types';

export async function createFlowVersion(
  db: SupabaseClient,
  tenantId: string,
  input: {
    flowKey: string;
    flow: FlowDocument;
    whatsappAccountId?: string | null;
    kind?: 'draft' | 'published' | 'restored';
    label?: string;
    createdBy?: string | null;
  },
) {
  const { data: last, error: lastError } = await db
    .from('flow_versions')
    .select('version_number')
    .eq('tenant_id', tenantId)
    .eq('flow_key', input.flowKey)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw lastError;

  const versionNumber = Number(last?.version_number || 0) + 1;
  const { data, error } = await db
    .from('flow_versions')
    .insert({
      tenant_id: tenantId,
      whatsapp_account_id: input.whatsappAccountId || null,
      flow_key: input.flowKey,
      flow_name: input.flow.name,
      schema_version: input.flow.schemaVersion || 2,
      version_number: versionNumber,
      kind: input.kind || 'draft',
      flow_data: input.flow,
      label: input.label || null,
      created_by: input.createdBy || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listFlowVersions(db: SupabaseClient, tenantId: string, flowKey: string) {
  const { data, error } = await db
    .from('flow_versions')
    .select('id,flow_key,flow_name,schema_version,version_number,kind,label,created_by,created_at,whatsapp_account_id')
    .eq('tenant_id', tenantId)
    .eq('flow_key', flowKey)
    .order('version_number', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function loadFlowVersion(db: SupabaseClient, tenantId: string, versionId: string): Promise<FlowDocument> {
  const { data, error } = await db
    .from('flow_versions')
    .select('flow_data')
    .eq('tenant_id', tenantId)
    .eq('id', versionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Versión no encontrada.');
  return data.flow_data as FlowDocument;
}
