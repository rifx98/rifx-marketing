-- Aggregate dashboard metrics inside Postgres. This replaces transferring all
-- sales, appointments and conversations to every browser poll.

CREATE INDEX IF NOT EXISTS sales_tenant_status_created_idx
  ON public.sales (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS conversations_tenant_status_stage_idx
  ON public.conversations (tenant_id, status, sales_stage);

CREATE INDEX IF NOT EXISTS appointments_tenant_status_idx
  ON public.appointments (tenant_id, status);

CREATE OR REPLACE FUNCTION public.get_tenant_dashboard_stats(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $dashboard_stats$
  SELECT pg_catalog.jsonb_build_object(
    'totalRevenue', COALESCE((
      SELECT pg_catalog.sum(s.amount)::numeric / 100
      FROM public.sales AS s
      WHERE s.tenant_id = p_tenant_id
        AND s.status = 'completed'
    ), 0),
    'totalSales', (
      SELECT pg_catalog.count(*)
      FROM public.sales AS s
      WHERE s.tenant_id = p_tenant_id
        AND s.status = 'completed'
    ),
    'activeConversations', (
      SELECT pg_catalog.count(*)
      FROM public.conversations AS c
      WHERE c.tenant_id = p_tenant_id
        AND c.status = 'chatting'
    ),
    'dailyIncome', COALESCE((
      SELECT pg_catalog.jsonb_object_agg(d.day_key, d.amount ORDER BY d.day_key)
      FROM (
        SELECT
          pg_catalog.to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day_key,
          pg_catalog.sum(s.amount)::numeric / 100 AS amount
        FROM public.sales AS s
        WHERE s.tenant_id = p_tenant_id
          AND s.status = 'completed'
          AND s.created_at >= pg_catalog.now() - INTERVAL '30 days'
        GROUP BY 1
      ) AS d
    ), '{}'::jsonb),
    'recentSales', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', recent.id,
          'customer', recent.customer_name,
          'amount', recent.amount::numeric / 100,
          'service', recent.service,
          'createdAt', recent.created_at,
          'status', recent.status
        ) ORDER BY recent.created_at DESC
      )
      FROM (
        SELECT s.id, s.customer_name, s.amount, s.service, s.created_at, s.status
        FROM public.sales AS s
        WHERE s.tenant_id = p_tenant_id
          AND s.status = 'completed'
        ORDER BY s.created_at DESC
        LIMIT 10
      ) AS recent
    ), '[]'::jsonb),
    'salesFunnel', (
      SELECT pg_catalog.jsonb_build_object(
        'new_lead', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'new_lead'),
        'discovery', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'discovery'),
        'qualified', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'qualified'),
        'proposal', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'proposal'),
        'objection', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'objection'),
        'closing', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'closing'),
        'won', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'won'),
        'lost', pg_catalog.count(*) FILTER (WHERE c.sales_stage = 'lost'),
        'avgLeadScore', COALESCE(pg_catalog.round(pg_catalog.avg(c.lead_score)), 0),
        'hotLeads', pg_catalog.count(*) FILTER (WHERE COALESCE(c.lead_score, 0) >= 70),
        'warmLeads', pg_catalog.count(*) FILTER (
          WHERE COALESCE(c.lead_score, 0) BETWEEN 40 AND 69
        ),
        'coldLeads', pg_catalog.count(*) FILTER (
          WHERE COALESCE(c.lead_score, 0) BETWEEN 0 AND 39
        )
      )
      FROM public.conversations AS c
      WHERE c.tenant_id = p_tenant_id
    ),
    'appointmentCounts', (
      SELECT pg_catalog.jsonb_build_object(
        'total', pg_catalog.count(*),
        'pending', pg_catalog.count(*) FILTER (WHERE a.status = 'pending'),
        'confirmed', pg_catalog.count(*) FILTER (WHERE a.status = 'confirmed'),
        'awaiting_reschedule', pg_catalog.count(*) FILTER (WHERE a.status = 'awaiting_reschedule'),
        'rescheduled', pg_catalog.count(*) FILTER (WHERE a.status = 'rescheduled'),
        'cancelled', pg_catalog.count(*) FILTER (WHERE a.status = 'cancelled'),
        'completed', pg_catalog.count(*) FILTER (WHERE a.status = 'completed'),
        'noShow', pg_catalog.count(*) FILTER (WHERE a.status = 'no_show'),
        'pendingCompletion', pg_catalog.count(*) FILTER (WHERE a.status = 'pending_completion')
      )
      FROM public.appointments AS a
      WHERE a.tenant_id = p_tenant_id
    )
  );
$dashboard_stats$;

REVOKE ALL ON FUNCTION public.get_tenant_dashboard_stats(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_dashboard_stats(uuid)
  TO service_role;

COMMENT ON FUNCTION public.get_tenant_dashboard_stats(uuid) IS
  'Returns tenant-scoped aggregate dashboard metrics; callable only by service_role.';
