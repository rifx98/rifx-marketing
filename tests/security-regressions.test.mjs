import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  SECRET_PLACEHOLDER,
  redactSecret,
  resolveSecretUpdate,
  safeEqualSecrets,
  validatePassword,
} from '../lib/security.ts';
import {
  UnsafeRemoteResourceError,
  decodeImageDataUri,
  isPrivateOrReservedIp,
} from '../lib/safe-fetch.ts';
import { CRON_HEALTH_POLICIES, evaluateCronRun } from '../lib/cron-health.ts';
import { isAllowedPushEndpoint } from '../lib/push-security.ts';
import { sha256Hex, verifyHmacSha256 } from '../lib/webhook-events.ts';

const repositoryRoot = process.cwd();
const source = (relativePath) => readFileSync(join(repositoryRoot, relativePath), 'utf8');

test('stored secrets are masked and the sentinel preserves the current value', () => {
  assert.equal(redactSecret('secret-value'), SECRET_PLACEHOLDER);
  assert.equal(redactSecret(''), '');
  assert.equal(resolveSecretUpdate(SECRET_PLACEHOLDER, 'stored-value'), 'stored-value');
  assert.equal(resolveSecretUpdate(' replacement ', 'stored-value'), 'replacement');
});

test('secret comparison rejects empty/mismatched values without length leakage', () => {
  assert.equal(safeEqualSecrets('same', 'same'), true);
  assert.equal(safeEqualSecrets('short', 'a-different-length'), false);
  assert.equal(safeEqualSecrets('', ''), false);
  assert.equal(safeEqualSecrets(null, 'value'), false);
});

test('password policy covers length, bcrypt byte limit, common values and email reuse', () => {
  assert.match(validatePassword('too-short') || '', /12/);
  assert.match(validatePassword('rifx2026rifx') || '', /predecible/);
  assert.match(validatePassword('alice-secure-password', 'alice@example.com') || '', /correo/);
  assert.match(validatePassword('🔒'.repeat(40)) || '', /72 bytes/);
  assert.equal(validatePassword('Long-and-random-2026!'), null);
});

test('SSRF guard recognizes private, loopback, metadata and documentation ranges', () => {
  for (const address of [
    '127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '::1', 'fc00::1', 'fe80::1',
    '::ffff:127.0.0.1', '192.0.2.10', '198.51.100.2', '203.0.113.8',
  ]) assert.equal(isPrivateOrReservedIp(address), true, address);
  assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);
  assert.equal(isPrivateOrReservedIp('2606:4700:4700::1111'), false);
});

test('data URI decoder enforces both media signature and byte limit', () => {
  const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const decoded = decodeImageDataUri(`data:image/png;base64,${pngHeader.toString('base64')}`, 32);
  assert.deepEqual(decoded.buffer, pngHeader);
  assert.throws(
    () => decodeImageDataUri(`data:image/png;base64,${Buffer.from('not-an-image').toString('base64')}`),
    UnsafeRemoteResourceError,
  );
  assert.throws(
    () => decodeImageDataUri(`data:image/png;base64,${pngHeader.toString('base64')}`, 2),
    UnsafeRemoteResourceError,
  );
});

test('webhook HMAC verification rejects malformed and tampered payloads', () => {
  const body = JSON.stringify({ event: 'payment_success', id: 'fixture-1' });
  const secret = 'local-regression-secret-32-bytes-minimum';
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  assert.equal(verifyHmacSha256(body, signature, secret), true);
  assert.equal(verifyHmacSha256(body, `sha256=${signature}`, secret), true);
  assert.equal(verifyHmacSha256(`${body} `, signature, secret), false);
  assert.equal(verifyHmacSha256(body, '00', secret), false);
  assert.equal(verifyHmacSha256(body, 'z'.repeat(64), secret), false);
  assert.match(sha256Hex(body), /^[0-9a-f]{64}$/);
});

test('payment webhooks and cron locks retain their fail-closed invariants', () => {
  const payphone = source('app/api/webhooks/payphone/route.ts');
  const lemon = source('app/api/webhooks/lemonsqueezy/route.ts');
  const lock = source('services/cron/lock.ts');
  const migration = source('supabase/migrations/015_security_hardening.sql');

  assert.match(payphone, /export async function GET\(\)[\s\S]*?405/);
  assert.match(payphone, /x-payphone-signature-256/);
  assert.match(payphone, /\.eq\('payphone_transaction_id', transactionId\)/);
  assert.match(payphone, /\.eq\('client_transaction_id', clientTransactionId\)/);
  assert.doesNotMatch(payphone, /process\.env\.PAYPHONE_TOKEN/);
  assert.match(lemon, /verifyHmacSha256/);
  assert.doesNotMatch(lemon, /planFromCustom|customData\.plan/);
  assert.match(lock, /\.eq\('owner_token', lock\.ownerToken\)/);
  assert.doesNotMatch(lock, /PGRST205|Tabla cron_locks no encontrada/);
  assert.match(lock, /throw new Error\('Distributed lock unavailable'\)/);
  assert.match(migration, /FUNCTION public\.claim_webhook_event/);
  assert.match(migration, /FUNCTION public\.complete_webhook_event/);
});

test('Lemon Squeezy subscription ownership and provider ordering stay atomic', () => {
  const lemon = source('app/api/webhooks/lemonsqueezy/route.ts');
  const lifecycle = source('app/api/panel/subscription/route.ts');
  const checkout = source('app/api/panel/checkout/route.ts');
  const migration = source('supabase/migrations/015_security_hardening.sql');

  assert.match(lemon, /process\.env\.LEMONSQUEEZY_STORE_ID/);
  assert.match(lemon, /storeId\s*!==\s*expectedStoreId/);
  assert.match(lemon, /p_event_timestamp:\s*eventTimestamp/);
  assert.match(lemon, /apply_lemonsqueezy_subscription_event/);
  assert.match(lemon, /tenant\.lemonsqueezy_subscription_id\s*!==\s*subscriptionId/);
  assert.match(lemon, /finishOrThrow\(supabase, claim, 'ignored', 'stale_subscription_event'\)/);
  assert.doesNotMatch(lemon, /\.from\('tenants'\)[\s\S]{0,120}\.update\(/);

  assert.match(lifecycle, /\.select\('lemonsqueezy_subscription_id'\)/);
  assert.match(lifecycle, /billingOwner\?\.lemonsqueezy_subscription_id/);
  assert.match(lifecycle, /rateLimitKey\('billing-lifecycle', tenant\.tenantId\)/);
  assert.match(lifecycle, /readStreamWithLimit\(req\.body, MAX_REQUEST_BYTES\)/);
  assert.match(lifecycle, /readStreamWithLimit\(response\.body, MAX_PROVIDER_RESPONSE_BYTES\)/);
  assert.doesNotMatch(lifecycle, /billing_subscription_id/);
  assert.doesNotMatch(lifecycle, /await req\.json\(\)/);
  assert.doesNotMatch(lifecycle, /\.from\('tenants'\)[\s\S]{0,160}\.update\(/);

  assert.match(checkout, /\.select\('lemonsqueezy_subscription_id'\)/);
  assert.match(checkout, /lemonRequest\(`\/subscriptions\/\$\{subscriptionId\}`[\s\S]*?method:\s*'PATCH'/);
  assert.match(checkout, /attributes:\s*\{ variant_id:\s*Number\(variantId\) \}/);
  assert.match(checkout, /process\.env\.APP_URL/);
  assert.match(checkout, /AbortSignal\.timeout\(PROVIDER_TIMEOUT_MS\)/);
  assert.match(checkout, /readStreamWithLimit\(response\.body, MAX_PROVIDER_RESPONSE_BYTES\)/);
  assert.match(checkout, /rateLimitKey\('billing-checkout', tenant\.tenantId\)/);
  assert.doesNotMatch(checkout, /redirect_url:\s*`\$\{req\.nextUrl\.origin\}/);
  assert.doesNotMatch(checkout, /console\.log\([^\n]*checkoutUrl/);
  assert.doesNotMatch(checkout, /error\.message\s*\|\|\s*['"]Internal error/);

  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS tenants_lemonsqueezy_subscription_uidx/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.apply_lemonsqueezy_subscription_event\([\s\S]*?SECURITY DEFINER/);
  assert.match(migration, /current_subscription_id\s*<>\s*p_subscription_id[\s\S]*?RETURN 'conflict'/);
  assert.match(migration, /p_event_timestamp\s*<=\s*current_event_timestamp[\s\S]*?RETURN 'stale'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.apply_lemonsqueezy_subscription_event\([\s\S]*?FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.apply_lemonsqueezy_subscription_event\([\s\S]*?TO service_role/);
});

test('critical authorization and tenant-isolation regressions stay closed', () => {
  const worker = source('app/api/panel/social/worker/route.ts');
  const configRoute = source('app/api/panel/config/route.ts');
  const whatsapp = source('app/api/whatsapp/route.ts');
  const migrationRoute = source('app/api/panel/migrate/route.ts');

  assert.doesNotMatch(worker, /X-Dev-Bypass|dev.?bypass/i);
  assert.match(worker, /SOCIAL_WORKER_SECRET/);
  assert.match(configRoute, /redactSecret\(config\.whatsapp_token\)/);
  assert.doesNotMatch(configRoute, /panel_password/);
  assert.match(whatsapp, /\.eq\('tenant_id', tenantId\)/);
  assert.match(whatsapp, /onConflict: 'tenant_id,phone_number'/);
  assert.doesNotMatch(whatsapp, /FACEBOOK_APP_SECRET/);
  assert.doesNotMatch(whatsapp, /process\.env\.WHATSAPP_TOKEN/);
  assert.match(migrationRoute, /status:\s*410/);
});

test('WhatsApp ingress acknowledges only durable, leased, tenant-routed messages', () => {
  const webhook = source('app/api/whatsapp/route.ts');
  const worker = source('app/api/cron/whatsapp/route.ts');
  const migration = source('supabase/migrations/018_whatsapp_ingress.sql');

  assert.match(webhook, /for \(const entry of entries\)[\s\S]*?for \(const change of changes\)[\s\S]*?for \(const message of messages\)/);
  assert.match(webhook, /MAX_INGRESS_MESSAGES\s*=\s*1000/);
  assert.match(webhook, /\.rpc\('enqueue_whatsapp_ingress_batch'/);
  assert.match(webhook, /Ingress temporarily unavailable[\s\S]*?status:\s*503/);
  assert.match(webhook, /x-rifx-whatsapp-worker/);
  assert.match(webhook, /\.rpc\('claim_whatsapp_delivery'/);
  assert.match(webhook, /\.rpc\('complete_whatsapp_delivery'/);
  assert.match(webhook, /deliveryKey\s*=\s*sha256Hex\(JSON\.stringify\(\[sourceMessageId, deliveryPurpose\]\)\)/);
  assert.match(webhook, /throw new Error\(`whatsapp_provider_http_/);

  assert.match(worker, /validateCronAuth\(req\)/);
  assert.match(worker, /if \(!cronSecret\)[\s\S]*?status:\s*503/);
  assert.match(worker, /safeEqualSecrets\(suppliedCronSecret, cronSecret\)/);
  assert.match(worker, /process\.env\.WHATSAPP_WORKER_SECRET \|\| cronSecret/);
  assert.match(worker, /process\.env\.APP_URL/);
  assert.match(worker, /\.rpc\('claim_whatsapp_ingress'/);
  assert.match(worker, /\.rpc\('complete_whatsapp_ingress'/);
  assert.match(worker, /p_lease_seconds:\s*900/);
  assert.match(worker, /AbortSignal\.timeout/);

  assert.match(migration, /CREATE TABLE public\.whatsapp_ingress/);
  assert.match(migration, /provider_message_id text NOT NULL UNIQUE/);
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
  assert.match(migration, /attempt_count >= ingress\.max_attempts THEN 'dead'/);
  assert.match(migration, /CREATE TABLE public\.whatsapp_outbound_deliveries/);
  assert.match(migration, /delivery_purpose text NOT NULL/);
  assert.match(migration, /expired processing lease with different content is ambiguous/i);
  assert.match(migration, /ALTER TABLE public\.whatsapp_ingress FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.whatsapp_outbound_deliveries FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.enqueue_whatsapp_ingress_batch\(jsonb\)[\s\S]*?FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.claim_whatsapp_ingress\(uuid, integer\) TO service_role/);
});

test('authentication fails closed for disabled tenants and missing Google audience', () => {
  const login = source('app/api/auth/login/route.ts');
  const google = source('app/api/auth/google/route.ts');
  const panel = source('app/panel/panel-client.tsx');

  assert.match(login, /tenant\.is_active === false/);
  assert.match(login, /Boolean\(tenant\.deleted_at\)/);
  assert.match(google, /process\.env\.NEXT_PUBLIC_GOOGLE_CLIENT_ID\?\.trim\(\)/);
  assert.match(google, /tenant\.is_active === false \|\| tenant\.deleted_at/);
  assert.doesNotMatch(google, /NEXT_PUBLIC_GOOGLE_CLIENT_ID\s*\|\|\s*['"]/);
  assert.doesNotMatch(panel, /NEXT_PUBLIC_GOOGLE_CLIENT_ID\s*\|\|\s*['"]/);
});

test('runtime database queries stay aligned with the canonical schema', () => {
  const banner = source('app/api/panel/analyze-banner/route.ts');
  const campaign = source('app/api/panel/campaigns/generate/route.ts');
  const conversations = source('app/api/panel/conversations/route.ts');

  assert.match(banner, /\.from\('config'\)[\s\S]*?\.select\('openai_key'\)/);
  assert.doesNotMatch(banner, /\.from\('panel_config'\)/);
  assert.match(campaign, /\.from\('config'\)[\s\S]*?\.select\('openai_key'\)/);
  assert.doesNotMatch(campaign, /\.from\('tenant_configs'\)/);
  assert.match(conversations, /updates\.customer_name\s*=\s*name\.trim\(\)/);
  assert.doesNotMatch(conversations, /updates\.name\s*=/);
  assert.match(conversations, /\.eq\('tenant_id', tenant\.tenantId\)[\s\S]*?\.select\('id'\)/);
});

test('dashboard polling uses a tenant-scoped aggregate instead of full-table transfers', () => {
  const stats = source('app/api/panel/stats/route.ts');
  const dashboardMigration = source('supabase/migrations/016_dashboard_stats.sql');
  const panel = source('app/panel/panel-client.tsx');

  assert.match(stats, /\.rpc\('get_tenant_dashboard_stats'/);
  assert.doesNotMatch(stats, /\.from\('(sales|appointments|conversations)'\)/);
  assert.match(dashboardMigration, /FUNCTION public\.get_tenant_dashboard_stats\(p_tenant_id uuid\)/);
  assert.match(dashboardMigration, /WHERE s\.tenant_id = p_tenant_id/);
  assert.match(dashboardMigration, /WHERE c\.tenant_id = p_tenant_id/);
  assert.match(dashboardMigration, /WHERE a\.tenant_id = p_tenant_id/);
  assert.match(dashboardMigration, /REVOKE ALL ON FUNCTION public\.get_tenant_dashboard_stats\(uuid\)[\s\S]*?FROM PUBLIC, anon, authenticated/);
  assert.match(dashboardMigration, /GRANT EXECUTE ON FUNCTION public\.get_tenant_dashboard_stats\(uuid\)[\s\S]*?TO service_role/);
  assert.match(panel, /window\.setInterval\(refreshCrmAndStats, 60_000\)/);
});

test('Meta and WhatsApp OAuth stay tenant-bound without exposing provider tokens', () => {
  const auth = source('lib/auth.ts');
  const meta = source('app/api/panel/meta/facebook-connect/route.ts');
  const whatsapp = source('app/api/panel/whatsapp/facebook-connect/route.ts');
  const panel = source('app/panel/panel-client.tsx');

  assert.match(auth, /oauthAction\?:\s*OAuthAction/);
  assert.match(auth, /setAudience\(OAUTH_STATE_AUDIENCE\)/);
  assert.match(auth, /setExpirationTime\('5m'\)/);

  for (const route of [meta, whatsapp]) {
    assert.match(route, /signOAuthState\(\{\s*tenantId:\s*tenant\.tenantId,\s*oauthAction:\s*OAUTH_ACTION\s*\}\)/);
    assert.match(route, /verifyOAuthState\(state\)/);
    assert.match(route, /verifiedState\.tenantId\s*!==\s*tenant\.tenantId/);
    assert.match(route, /verifiedState\.oauthAction\s*!==\s*OAUTH_ACTION/);
    assert.match(route, /accessToken:\s*SECRET_PLACEHOLDER/);
    assert.match(route, /Cache-Control':\s*'no-store/);
    assert.match(route, /AbortSignal\.timeout\(GRAPH_TIMEOUT_MS\)/);
    assert.doesNotMatch(route, /body\.redirectUri/);
    assert.doesNotMatch(route, /\{\s*code,\s*redirectUri\s*\}\s*=\s*await req\.json/);
    assert.doesNotMatch(route, /return (?:json|NextResponse\.json)\(\{\s*accessToken[,}]/);
  }

  assert.match(meta, /accessToken\s*!==\s*SECRET_PLACEHOLDER/);
  assert.match(whatsapp, /accessTokenInput\s*!==\s*SECRET_PLACEHOLDER/);
  assert.equal((panel.match(/action:\s*'request_state'/g) || []).length, 2);
  assert.equal((panel.match(/JSON\.stringify\(\{\s*code,\s*state:\s*returnedState\s*\}\)/g) || []).length, 2);
  assert.doesNotMatch(panel, /btoa\(JSON\.stringify\(\{\s*action:\s*['"](?:meta_connect|wa_connect)/);
  assert.doesNotMatch(panel, /JSON\.stringify\(\{\s*code,\s*redirectUri:/);
});

test('push ownership and announcement link validation remain fail-closed', () => {
  const push = source('app/api/panel/push/route.ts');
  const alerts = source('lib/alerts.ts');
  const admin = source('app/api/admin/dashboard/route.ts');

  assert.match(push, /endpoint\.protocol\s*!==\s*'https:'/);
  assert.match(push, /EXACT_PUSH_HOSTS/);
  assert.match(push, /PUSH_HOST_SUFFIXES/);
  assert.match(push, /existing\.tenant_id\s*!==\s*tenant\.tenantId/);
  assert.equal((push.match(/otra cuenta' \}, 409\)/g) || []).length, 2);
  assert.match(push, /\.insert\(\{/);
  assert.doesNotMatch(push, /\.upsert\(/);
  assert.match(push, /\.delete\(\)[\s\S]{0,160}\.eq\('tenant_id', tenant\.tenantId\)[\s\S]{0,120}\.eq\('endpoint', endpoint\)/);
  assert.match(alerts, /\.delete\(\)[\s\S]{0,160}\.eq\('tenant_id', tenantId\)[\s\S]{0,120}\.eq\('endpoint', sub\.endpoint\)/);

  assert.match(admin, /MAX_ANNOUNCEMENT_URL_LENGTH\s*=\s*2_048/);
  assert.match(admin, /url\.protocol\s*!==\s*'https:'/);
  assert.match(admin, /url\.username\s*\|\|\s*url\.password/);
  assert.equal((admin.match(/normalizeAnnouncementButtonUrl\(button_url\)/g) || []).length, 2);
});

test('admin APIs enforce centralized live and default-deny RBAC', () => {
  const rbac = source('lib/admin-rbac.ts');
  const dashboard = source('app/api/admin/dashboard/route.ts');
  const platformSettings = source('app/api/admin/platform-settings/route.ts');

  assert.match(rbac, /FULL_ADMIN_ROLES\s*=\s*new Set\(\['full', 'superadmin'\]\)/);
  assert.match(rbac, /getTenantFromRequest\(req\)/);
  assert.match(rbac, /\.select\('id,is_admin,admin_role,admin_sections,admin_can_edit_plans'\)/);
  assert.match(rbac, /liveTenant\.is_admin\s*!==\s*true/);
  assert.match(rbac, /authenticatedTenant\.isAdmin\s*!==\s*true/);
  assert.match(rbac, /if \(!Array\.isArray\(rawValue\)\) return \[\]/);
  assert.match(rbac, /if \(rule\.fullOnly\) return false/);
  assert.match(rbac, /rule\.requiresPlanEditing && !admin\.adminCanEditPlans/);
  assert.match(rbac, /Object\.prototype\.hasOwnProperty\.call\(ADMIN_DASHBOARD_ACTION_PERMISSIONS, action\)/);

  const protectedRoutes = new Map([
    ['app/api/admin/dashboard/route.ts', 2],
    ['app/api/admin/improve-announcement/route.ts', 1],
    ['app/api/admin/platform-settings/route.ts', 2],
    ['app/api/admin/templates/route.ts', 3],
    ['app/api/admin/templates/detect-zones/route.ts', 1],
    ['app/api/admin/templates/seed/route.ts', 1],
    ['app/api/admin/upload/route.ts', 1],
  ]);
  for (const [relativePath, expectedChecks] of protectedRoutes) {
    const route = source(relativePath);
    assert.match(route, /from '@\/lib\/admin-rbac'/, relativePath);
    assert.equal(
      (route.match(/requireAdminPermission\(/g) || []).length,
      expectedChecks,
      `${relativePath} must authorize every handler`,
    );
    assert.doesNotMatch(route, /getTenantFromRequest|verifyToken/, relativePath);
  }

  assert.match(platformSettings, /GET\(request: NextRequest\)[\s\S]*?requireAdminPermission\(request, 'platform_settings\.read'\)/);
  assert.match(platformSettings, /POST\(request: NextRequest\)[\s\S]*?requireAdminPermission\(request, 'platform_settings\.update'\)/);
  assert.match(dashboard, /getDashboardAdminPermission\(body\?\.action\)/);
  assert.match(dashboard, /if \(!permission\)[\s\S]*?status:\s*400/);
  assert.match(dashboard, /canViewAnnouncements\s*\?\s*announcements\s*:\s*\[\]/);
  assert.match(dashboard, /canViewTenants\s*\?\s*tenants\s*:\s*canViewOverview\s*\?\s*tenants\.slice\(0, 5\)\s*:\s*\[\]/);
  const deleteTenantBlock = dashboard.match(
    /if \(body\.action === 'delete_tenant'\) \{[\s\S]*?return NextResponse\.json\(\{ success: true \}\);\s*\}/,
  )?.[0] || '';
  assert.match(deleteTenantBlock, /TENANT_ID_PATTERN\.test\(targetTenantId\)/);
  assert.match(deleteTenantBlock, /deleted_at:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(deleteTenantBlock, /is_active:\s*false/);
  assert.match(deleteTenantBlock, /session_version:\s*currentSessionVersion \+ 1/);
  assert.match(deleteTenantBlock, /\.eq\('session_version', currentSessionVersion\)/);
  assert.doesNotMatch(deleteTenantBlock, /\.delete\(\)/);

  for (const action of [
    'create_announcement', 'update_announcement', 'delete_announcement',
    'toggle_announcement', 'update_tenant_plan', 'toggle_admin',
    'update_plan_permissions', 'update_tenant_overrides', 'delete_tenant',
  ]) {
    assert.match(rbac, new RegExp(`\\b${action}:\\s*'[^']+'`), action);
  }
});

test('legacy AI and contact endpoints bound inputs, providers and error disclosure', () => {
  const improve = source('app/api/admin/improve-announcement/route.ts');
  const detectZones = source('app/api/admin/templates/detect-zones/route.ts');
  const addContact = source('app/api/panel/add-contact/route.ts');

  for (const route of [improve, detectZones, addContact]) {
    assert.match(route, /readLimitedJsonObject\(req,/);
    assert.match(route, /enforceTenantRateLimit\(/);
    assert.doesNotMatch(route, /await req\.json\(\)/);
    assert.doesNotMatch(route, /error\?\.message\s*\|\||error\.message\s*\|\|/);
  }

  assert.match(improve, /requireAdminPermission\(req, 'announcements\.improve'\)/);
  assert.match(improve, /timeout:\s*20_000/);
  assert.match(improve, /maxRetries:\s*1/);
  assert.match(improve, /\.select\('openai_key'\)[\s\S]*?\.eq\('tenant_id', tenant\.tenantId\)/);
  assert.doesNotMatch(improve, /Respuesta RAW|Anuncio mejorado parseado/);

  assert.match(detectZones, /requireAdminPermission\(req, 'templates\.detect'\)/);
  assert.match(detectZones, /decodeImageDataUri\(imageUrl, MAX_IMAGE_BYTES\)/);
  assert.match(detectZones, /fetchRemoteImage\(parsedUrl\.toString\(\),/);
  assert.match(detectZones, /parsedUrl\.protocol !== 'https:'/);
  assert.match(detectZones, /image_url:\s*\{ url: normalizedImage/);
  assert.match(detectZones, /timeout:\s*30_000/);
  assert.match(detectZones, /maxRetries:\s*1/);
  assert.doesNotMatch(detectZones, /console\.(?:log|warn|error)\([^\n]*(?:imageUrl|resultText)/);

  assert.match(addContact, /denyUnlessFeature\(tenant, 'crm'\)/);
  assert.match(addContact, /\.select\('openai_key,whatsapp_token,whatsapp_phone_id,ai_prompt'\)/);
  assert.match(addContact, /timeout:\s*20_000/);
  assert.match(addContact, /maxRetries:\s*1/);
  assert.match(addContact, /AbortSignal\.timeout\(PROVIDER_TIMEOUT_MS\)/);
  assert.match(addContact, /readLimitedResponseJson\(response, MAX_PROVIDER_RESPONSE_BYTES\)/);
  assert.doesNotMatch(addContact, /console\.(?:log|warn|error)\([^\n]*(?:safePhone|finalMessage|responsePayload)/);
  assert.doesNotMatch(addContact, /waResult\.error|waResult\?\.error|templateData/);
});

test('social OAuth stays action-bound, entitlement-gated and free of URL secrets', () => {
  const helper = source('lib/social-oauth.ts');
  const accounts = source('app/api/panel/social/accounts/route.ts');
  const callbacks = new Map([
    ['app/api/panel/social/accounts/google-callback/route.ts', 'social'],
    ['app/api/panel/social/accounts/tiktok-callback/route.ts', 'social'],
    ['app/api/panel/social/accounts/google-calendar-callback/route.ts', 'appointments'],
  ]);

  assert.match(helper, /process\.env\.APP_URL\s*\|\|/);
  assert.match(helper, /process\.env\.NODE_ENV !== 'production'\s*\?\s*process\.env\.NEXT_PUBLIC_APP_URL/);
  assert.match(helper, /process\.env\.NODE_ENV === 'production' && url\.protocol !== 'https:'/);
  assert.match(helper, /verifiedState\.oauthAction !== SOCIAL_OAUTH_ACTION/);
  assert.match(helper, /\.select\('id,plan,plan_status,plan_expires_at,permission_overrides,is_admin,is_active,deleted_at'\)/);
  assert.match(helper, /tenant\.is_active === false \|\| tenant\.deleted_at/);
  assert.match(helper, /tenantCanUseFeature\([\s\S]*?feature\)/);
  assert.match(helper, /redirect:\s*'error'/);
  assert.match(helper, /AbortSignal\.timeout\(OAUTH_FETCH_TIMEOUT_MS\)/);
  assert.match(helper, /MAX_OAUTH_RESPONSE_BYTES\s*=\s*256 \* 1024/);
  assert.match(helper, /readBodyWithLimit\(req\.body, MAX_OAUTH_REQUEST_BYTES\)/);

  assert.match(accounts, /signOAuthState\(\{[\s\S]*?oauthAction:\s*SOCIAL_OAUTH_ACTION/);
  assert.match(accounts, /denyUnlessFeature\(tenant, 'social'\)/);
  assert.match(accounts, /denyUnlessFeature\(tenant, feature\)/);
  assert.match(accounts, /body\.action === 'link_manual'[\s\S]*?NODE_ENV === 'production'/);
  assert.match(accounts, /readLimitedJsonBody\(req\)/);
  assert.doesNotMatch(accounts, /oauth\/access_token\?/);
  assert.equal((accounts.match(/method:\s*'POST'/g) || []).length >= 2, true);

  const oauthRoutes = [accounts];
  for (const [relativePath, feature] of callbacks) {
    const callback = source(relativePath);
    oauthRoutes.push(callback);
    assert.match(callback, /verifySocialOAuthState\(state\)/, relativePath);
    assert.match(
      callback,
      new RegExp(`oauthTenantCanUseFeature\\(supabase, tenantId, '${feature}'\\)`),
      relativePath,
    );
    assert.match(callback, /fetchOAuthJson/);
  }

  for (const route of oauthRoutes) {
    assert.doesNotMatch(route, /new URL\(req\.url\)\.origin/);
    assert.doesNotMatch(route, /process\.env\.NEXT_PUBLIC_APP_URL/);
    assert.doesNotMatch(route, /decodeURIComponent\(state\)/);
    assert.doesNotMatch(route, /\bfetch\(/);
    assert.doesNotMatch(route, /[?&](?:access_token|client_secret)=/);
    assert.doesNotMatch(route, /(?:error|dbError)\.message/);
    assert.doesNotMatch(route, /encodeURIComponent\([^)]*error/);
  }
});

test('scheduled social publishing signs R2 media at execution and rejects partial database fan-out', () => {
  const publish = source('app/api/panel/social/publish/route.ts');
  const worker = source('app/api/panel/social/worker/route.ts');
  const storage = source('app/api/panel/social/storage/route.ts');
  const r2 = source('lib/r2.ts');

  assert.match(r2, /export function isTenantOwnedR2Key/);
  assert.match(publish, /denyUnlessFeature\(tenant, 'social'\)/);
  assert.match(publish, /video_public_url:\s*null/);
  assert.doesNotMatch(publish, /getDownloadPresignedUrl/);
  assert.match(publish, /\.insert\(accountIds\.map/);
  assert.match(publish, /publicationsError\s*\|\|\s*publicationIds\.length\s*!==\s*accountIds\.length/);
  assert.match(publish, /rollbackPost\(supabase, tenant\.tenantId, post\.id, publicationIds\)/);
  assert.match(publish, /queued:\s*Boolean\(queueConfig\)/);

  assert.doesNotMatch(worker, /post\.video_public_url/);
  assert.match(worker, /select\('id, tenant_id, title, caption, video_storage_path, video_type'\)/);
  assert.match(worker, /headFile\(post\.video_storage_path\)[\s\S]*getDownloadPresignedUrl\(post\.video_storage_path, FRESH_MEDIA_URL_SECONDS\)[\s\S]*publishToProvider\(/);
  assert.match(worker, /isTenantOwnedR2Key\(post\.video_storage_path, post\.tenant_id\)/);
  assert.match(worker, /denyUnlessFeature\(requestingTenant, 'social'\)/);
  assert.match(worker, /social_feature_unavailable/);
  assert.equal((storage.match(/isTenantOwnedR2Key\(/g) || []).length, 3);
  assert.equal((storage.match(/denyUnlessFeature\(tenant, 'social'\)/g) || []).length, 3);
});

test('social delivery uses atomic leases, signed QStash messages and a database dead-letter', () => {
  const migration = source('supabase/migrations/021_social_worker_hardening.sql');
  const publish = source('app/api/panel/social/publish/route.ts');
  const worker = source('app/api/panel/social/worker/route.ts');
  const scheduler = source('services/cron/social-publication.ts');
  const queue = source('lib/social-queue.ts');
  const health = source('app/api/cron/health/route.ts');
  const panel = source('app/panel/panel-client.tsx');
  const meta = source('services/social/meta.ts');

  assert.match(migration, /status IN \('pending', 'processing', 'retry', 'published', 'failed', 'dead'\)/);
  assert.match(migration, /FUNCTION public\.claim_social_publication\(/);
  assert.match(migration, /FUNCTION public\.claim_due_social_dispatches\(/);
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
  assert.match(migration, /expired_provider_lease_ambiguous/);
  assert.match(migration, /FUNCTION public\.recover_expired_social_publications\(/);
  assert.match(migration, /FUNCTION public\.get_social_publication_health\(\)/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.claim_social_publication[\s\S]*?FROM PUBLIC, anon, authenticated/);

  assert.match(publish, /readLimitedJsonObject\(req, MAX_REQUEST_BYTES\)/);
  assert.match(publish, /available_at:\s*normalizedSchedule/);
  assert.match(publish, /dispatch_after:\s*normalizedSchedule/);
  assert.doesNotMatch(publish, /qstash\.upstash\.io|Upstash-Not-Before/);

  assert.match(worker, /maxDuration\s*=\s*60/);
  assert.match(worker, /PROVIDER_TIMEOUT_MS\s*=\s*45_000/);
  assert.match(worker, /verifyQstashRequest\(qstashSignature, parsedBody\.raw, queueConfig\)/);
  assert.match(worker, /\.rpc\('claim_social_publication'/);
  assert.match(worker, /'mark_social_provider_started'/);
  assert.match(worker, /'complete_social_publication'/);
  assert.doesNotMatch(worker, /maxDuration\s*=\s*300/);

  assert.match(scheduler, /\.rpc\(\s*'claim_due_social_dispatches'/);
  assert.match(scheduler, /dispatchSocialPublication\(queueConfig, publicationId, dispatchToken\)/);
  assert.match(scheduler, /\.rpc\('complete_social_dispatch'/);
  assert.match(queue, /jwtVerify\(/);
  assert.match(queue, /issuer:\s*'Upstash'/);
  assert.match(queue, /payload\.sub === config\.workerUrl/);
  assert.match(queue, /safeEqualSecrets\(signedBody, expectedBody\)/);
  assert.match(queue, /'Upstash-Deduplication-Id'/);
  assert.match(queue, /'Upstash-Timeout':\s*'55s'/);
  assert.match(queue, /'Upstash-Redact-Fields'/);
  assert.match(health, /\.rpc\('get_social_publication_health'\)/);
  assert.equal((panel.match(/!data\.queued && data\.publicationIds/g) || []).length, 2);

  assert.doesNotMatch(meta, /access_token=/);
  assert.match(meta, /signal\??:\s*AbortSignal/);
});

test('Supabase Storage bootstrap is private, bounded and never created at runtime', () => {
  const migration = source('supabase/migrations/017_storage_buckets.sql');
  const adminUpload = source('app/api/admin/upload/route.ts');
  const assetProxy = source('app/api/assets/uploads/[...path]/route.ts');
  const chatUpload = source('app/api/panel/send-message/route.ts');
  const knowledge = source('app/api/panel/knowledge/route.ts');
  const storageRoutes = [adminUpload, assetProxy, chatUpload, knowledge].join('\n');

  assert.match(migration, /'knowledge-base'[\s\S]*?false,[\s\S]*?10485760/);
  assert.match(migration, /'chat_media'[\s\S]*?false,[\s\S]*?16777216/);
  assert.match(migration, /'uploads'[\s\S]*?false,[\s\S]*?5242880/);
  assert.match(migration, /ON CONFLICT \(id\) DO UPDATE[\s\S]*public = EXCLUDED\.public/);
  assert.equal((migration.match(/AS RESTRICTIVE/g) || []).length, 2);
  assert.match(migration, /TO anon, authenticated[\s\S]*bucket_id <> ALL/);
  assert.match(migration, /REVOKE ALL ON TABLE storage\.buckets, storage\.objects FROM PUBLIC/);
  assert.match(migration, /GRANT SELECT ON TABLE storage\.buckets TO service_role/);
  assert.match(migration, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE storage\.objects TO service_role/);

  assert.doesNotMatch(storageRoutes, /storage\.createBucket|\.createBucket\(/);
  assert.doesNotMatch(adminUpload, /getPublicUrl\(/);
  assert.match(adminUpload, /getAssetUrl\(publicOrigin, fileName\)/);
  assert.match(adminUpload, /process\.env\.NODE_ENV === 'production'[\s\S]*APP_URL/);
  assert.match(assetProxy, /PUBLIC_UPLOAD_PATH/);
  assert.match(assetProxy, /\.from\('uploads'\)\.download\(objectPath\)/);
  assert.match(assetProxy, /X-Content-Type-Options': 'nosniff'/);
  assert.match(chatUpload, /if \(uploadError\)[\s\S]*status: 503/);
  assert.match(knowledge, /if \(rawUploadError\) throw new Error\('Knowledge file write failed'\)/);
  assert.doesNotMatch(knowledge, /saveKBIndex|getKBIndex/);
  assert.match(knowledge, /\.upload\(storagePath, buffer, \{[\s\S]*upsert: false/);
});

test('knowledge metadata is transactional, tenant scoped and legacy index migration is non-destructive', () => {
  const route = source('app/api/panel/knowledge/route.ts');
  const migration = source('supabase/migrations/020_knowledge_documents.sql');
  const runbook = source('SECURITY_OPERATIONS.md');
  const panel = source('app/panel/panel-client.tsx');
  const testAi = source('app/api/panel/test-ai/route.ts');
  const whatsapp = source('app/api/whatsapp/route.ts');

  assert.match(migration, /CREATE TABLE public\.knowledge_documents/);
  assert.match(migration, /UNIQUE \(tenant_id, file_name\)/);
  assert.match(migration, /storage_path text NOT NULL UNIQUE/);
  assert.match(migration, /file_size_bytes BETWEEN 1 AND 10485760/);
  assert.match(migration, /status IN \('ready', 'delete_pending'\)/);
  assert.match(migration, /CREATE TABLE public\.knowledge_storage_cleanup/);
  assert.match(migration, /CREATE TABLE public\.knowledge_index_imports/);
  assert.equal((migration.match(/FORCE ROW LEVEL SECURITY/g) || []).length, 3);
  assert.equal((migration.match(/FROM PUBLIC, anon, authenticated/g) || []).length, 9);
  assert.match(migration, /GRANT SELECT ON TABLE public\.knowledge_documents TO service_role/);
  assert.match(migration, /FUNCTION public\.import_legacy_knowledge_index/);
  assert.match(migration, /FUNCTION public\.upsert_knowledge_document/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /FUNCTION public\.begin_knowledge_document_delete/);
  assert.match(migration, /FUNCTION public\.complete_knowledge_document_delete/);
  assert.doesNotMatch(migration, /CREATE POLICY|GRANT ALL/);

  assert.match(route, /enforceTenantRateLimit/);
  assert.match(route, /readLimitedMultipartFormData/);
  assert.match(route, /readLimitedJsonObject\(req, 4096\)/);
  assert.match(route, /importLegacyIndexOnce/);
  assert.match(route, /\.download\(`\$\{tenantId\}\/index\.json`\)/);
  assert.match(route, /p_source_index_found: true/);
  assert.doesNotMatch(route, /\.upload\([^\n]*index\.json|saveKBIndex|getKBIndex/);
  assert.match(route, /\.from\('knowledge_documents'\)/);
  assert.match(route, /\.eq\('tenant_id', tenantId\)/);
  assert.match(route, /'upsert_knowledge_document'/);
  assert.match(route, /verificationError[\s\S]*!referenced[\s\S]*\.remove\(\[storagePath\]\)/);
  assert.match(route, /'begin_knowledge_document_delete'/);
  assert.match(route, /'complete_knowledge_document_delete'/);
  assert.match(route, /\.from\(KNOWLEDGE_BUCKET\)[\s\S]*\.remove\(\[deletion\.object_path\]\)/);

  assert.match(runbook, /Knowledge metadata migration 020/);
  assert.match(runbook, /index\.json/);
  assert.match(runbook, /non-destructive|no destructiv/i);
  assert.match(panel, /if \(!res\.ok \|\| !data\.success\) throw new Error\('knowledge_update_failed'\)/);
  assert.match(panel, /if \(!res\.ok \|\| !data\.success\) throw new Error\('knowledge_delete_failed'\)/);

  for (const reader of [testAi, whatsapp]) {
    assert.doesNotMatch(reader, /knowledge-base|index\.json|getKBIndex/);
    assert.match(reader, /\.from\('knowledge_documents'\)/);
    assert.match(reader, /\.select\('file_name, content'\)/);
    assert.match(reader, /\.eq\('tenant_id', tenantId\)/);
    assert.match(reader, /\.eq\('status', 'ready'\)/);
    assert.match(reader, /\.eq\('active', true\)/);
    assert.match(reader, /\.order\('created_at', \{ ascending: true \}\)/);
    assert.match(reader, /\.order\('id', \{ ascending: true \}\)/);
    assert.match(reader, /\.limit\(100\)/);
  }
});

test('Supabase migrations bootstrap an empty database with fail-closed tenant ownership', () => {
  const migrationDirectory = join(repositoryRoot, 'supabase', 'migrations');
  const migrationNames = readdirSync(migrationDirectory)
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .sort();
  const expectedBootstrapChain = [
    '000_baseline.sql',
    '001_ad_campaigns.sql',
    '002_creative_templates.sql',
    '003_add_scheduled_at.sql',
    '004_add_video_type.sql',
    '005_appointments_reminders.sql',
    '006_appointments_v2.sql',
    '007_customer_profiles.sql',
    '008_push_subscriptions.sql',
    '009_admin_sections.sql',
    '010_announcement_scheduling.sql',
    '011_announcement_training_type.sql',
    '012_enable_rls_lockdown.sql',
    '013_fix_permissive_policies.sql',
    '014_terms_acceptance.sql',
    '015_security_hardening.sql',
    '016_dashboard_stats.sql',
    '017_storage_buckets.sql',
    '018_whatsapp_ingress.sql',
    '019_monthly_briefing.sql',
    '020_knowledge_documents.sql',
  ];
  assert.deepEqual(
    migrationNames.slice(0, expectedBootstrapChain.length),
    expectedBootstrapChain,
  );

  const baseline = source('supabase/migrations/000_baseline.sql');
  const lockdown = source('supabase/migrations/012_enable_rls_lockdown.sql');
  const hardening = source('supabase/migrations/015_security_hardening.sql');
  const numberedSql = migrationNames.map((name) => source(`supabase/migrations/${name}`)).join('\n');
  const nonStorageNumberedSql = migrationNames
    .filter((name) => name !== '017_storage_buckets.sql')
    .map((name) => source(`supabase/migrations/${name}`))
    .join('\n');

  for (const table of [
    'tenants', 'config', 'conversations', 'messages', 'sales', 'payments',
    'announcements', 'platform_settings', 'service_pricing', 'tenant_members',
    'social_accounts', 'social_posts', 'social_publications', 'social_logs',
    'cron_locks', 'cron_runs',
  ]) {
    assert.match(
      baseline,
      new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\s*\\(`),
      `missing baseline table ${table}`,
    );
    assert.match(
      baseline,
      new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY`),
      `missing FORCE RLS for ${table}`,
    );
  }

  assert.doesNotMatch(baseline, /CREATE POLICY/i);
  assert.doesNotMatch(nonStorageNumberedSql, /CREATE POLICY/i);
  assert.doesNotMatch(
    source('supabase/migrations/017_storage_buckets.sql'),
    /CREATE POLICY[\s\S]*?AS PERMISSIVE/i,
  );
  assert.doesNotMatch(numberedSql, /TO service_role\s+FOR ALL/i);
  assert.doesNotMatch(baseline, /conversation_pricing_usage|subscription_payments|CREATE TABLE IF NOT EXISTS public\.subscriptions/i);
  assert.doesNotMatch(lockdown, /conversation_pricing_usage|subscription_payments|ALTER TABLE subscriptions/i);
  assert.match(lockdown, /FROM PUBLIC, anon, authenticated/);
  assert.match(lockdown, /TO service_role/);

  assert.match(baseline, /tenant_id uuid NOT NULL REFERENCES public\.tenants\(id\)/i);
  assert.match(baseline, /FUNCTION public\.set_message_tenant/);
  assert.match(baseline, /FUNCTION public\.set_social_publication_tenant/);
  assert.match(baseline, /social publication cannot cross tenant boundaries/);
  assert.match(source('supabase/migrations/007_customer_profiles.sql'), /UNIQUE \(tenant_id, phone_number\)/);
  assert.doesNotMatch(source('supabase/migrations/007_customer_profiles.sql'), /phone_number TEXT PRIMARY KEY/i);
  assert.doesNotMatch(source('supabase/migrations/006_appointments_v2.sql'), /DROP COLUMN IF EXISTS reminder_sent/i);

  assert.match(hardening, /\('tenants', 'storage_used_bytes', 'bigint'\)/);
  assert.match(hardening, /messages contains an orphan or cross-tenant conversation link/);
  assert.match(hardening, /social_publications_tenant_account_fkey/);
  assert.match(hardening, /ALTER COLUMN tenant_id SET NOT NULL/);
});

test('cron health fails closed for failed, missing and stale critical jobs', () => {
  const now = Date.UTC(2026, 7, 18, 12);
  const run = (startedMinutesAgo, overrides = {}) => ({
    started_at: new Date(now - startedMinutesAgo * 60_000).toISOString(),
    finished_at: new Date(now - Math.max(startedMinutesAgo - 1, 0) * 60_000).toISOString(),
    duration_seconds: 3.25,
    processed_count: 2,
    skipped_count: 1,
    error_count: 0,
    success: true,
    ...overrides,
  });

  assert.equal(evaluateCronRun('appointments', run(10), now).status, 'healthy');
  assert.equal(evaluateCronRun('appointments', run(46), now).status, 'stale');
  assert.equal(evaluateCronRun('messages', run(2, { success: false }), now).status, 'failed');
  assert.equal(evaluateCronRun('cold-leads', null, now).status, 'never_executed');
  assert.equal(
    evaluateCronRun('cleanup-media', run(2, { finished_at: null, success: null }), now).status,
    'running',
  );
  assert.equal(CRON_HEALTH_POLICIES.messages.maxAgeMs, 15 * 60_000);
  assert.equal(CRON_HEALTH_POLICIES['monthly-briefing'].maxAgeMs, 35 * 24 * 60 * 60_000);

  const route = source('app/api/cron/health/route.ts');
  assert.match(route, /status:\s*overallHealthy\s*\?\s*200\s*:\s*503/);
  assert.match(route, /error:\s*'Health status unavailable'/);
  assert.doesNotMatch(route, /error\.message|error_details|recent_errors/);
  assert.doesNotMatch(route, /\.from\('cron_runs'\)[\s\S]{0,120}\.select\('\*'\)/);
});

test('monthly briefing is bounded, idempotent, tenant scoped and contains no PII logs', () => {
  const route = source('app/api/cron/monthly-briefing/route.ts');
  const migration = source('supabase/migrations/019_monthly_briefing.sql');
  const config = source('app/api/panel/config/route.ts');
  const panel = source('app/panel/panel-client.tsx');
  const alerts = source('lib/alerts.ts');
  const schedule = source('supabase-pgcron-setup.sql');

  assert.match(route, /acquireLock\(CRON_NAME, LOCK_MINUTES\)/);
  assert.match(route, /startRunLog\(CRON_NAME\)/);
  assert.match(route, /claim_monthly_briefing_batch/);
  assert.match(route, /complete_monthly_briefing_delivery/);
  assert.match(route, /\.select\('endpoint, keys_p256dh, keys_auth'\)/);
  assert.match(route, /\.eq\('tenant_id', row\.tenantId\)/);
  assert.match(route, /MAX_PUSH_SUBSCRIPTIONS/);
  assert.match(route, /isAllowedPushEndpoint/);
  assert.match(route, /processed_ids:\s*\[\]/);
  assert.doesNotMatch(route, /openai_key|allConvs|conversationIds|company_name/);
  assert.doesNotMatch(route, /console\.(?:log|warn|error)\([^\n]*(?:tenantId|row\.|message|revenue)/);

  assert.match(migration, /ADD COLUMN IF NOT EXISTS monthly_briefing boolean NOT NULL DEFAULT false/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.monthly_briefing_deliveries/);
  assert.match(migration, /PRIMARY KEY \(tenant_id, period_start\)/);
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
  assert.match(migration, /claimed\.tenant_id = message\.tenant_id/);
  assert.match(migration, /ALTER TABLE public\.monthly_briefing_deliveries FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /TO service_role/);

  assert.match(config, /alert_email:\s*config\.alert_email/);
  assert.match(config, /monthly_briefing:\s*config\.monthly_briefing === true/);
  assert.doesNotMatch(config, /alert_email:\s*parsed\.alert_email|alert_email:\s*body\.alert_email[^\n]*current\.alert_email/);
  assert.match(panel, /monthly_briefing:\s*!!configData\.monthly_briefing/);
  assert.match(alerts, /select\('email_alerts, push_notifications, alert_email'\)/);
  assert.doesNotMatch(alerts, /select\('openai_key'\)|EMAIL PENDIENTE|toEmail/);

  assert.match(schedule, /jobname = 'invoke-monthly-briefing-cron'/);
  assert.match(schedule, /'0 12 1 \* \*'/);
  assert.match(schedule, /private\.invoke_cron_endpoint\('\/api\/cron\/monthly-briefing'\)/);
});

test('stored push endpoints remain restricted to known HTTPS push services', () => {
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/example'), true);
  assert.equal(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/example'), true);
  assert.equal(isAllowedPushEndpoint('https://web.push.apple.com/Qexample'), true);
  assert.equal(isAllowedPushEndpoint('http://fcm.googleapis.com/fcm/send/example'), false);
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.test/example'), false);
  assert.equal(isAllowedPushEndpoint('https://127.0.0.1/internal'), false);
  assert.equal(isAllowedPushEndpoint('https://user:pass@fcm.googleapis.com/example'), false);
});

test('tracked and untracked nonignored source tree contains no recognizable live credential literals', () => {
  const candidates = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
    },
  ).split('\0').filter(Boolean);
  const detectors = [
    /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    /EAA[A-Za-z0-9_-]{30,}/,
    /rifx_cron_20\d{2}_[A-Za-z0-9_-]{12,}/,
    /TINA_TOKEN\s*[=:]\s*["'][a-f0-9]{32,}["']/i,
  ];
  const violations = [];
  for (const relativePath of candidates) {
    let contents;
    try {
      contents = readFileSync(join(repositoryRoot, relativePath), 'utf8');
    } catch {
      continue;
    }
    if (contents.includes('\0')) continue;
    if (detectors.some((detector) => detector.test(contents))) violations.push(relativePath);
  }
  assert.deepEqual(violations, [], `credential-like literals found in: ${violations.join(', ')}`);
});
