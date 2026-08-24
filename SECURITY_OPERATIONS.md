# Security operations runbook

This repository contains schema hardening that **has not been applied to any
remote Supabase project**. Treat database changes, secret rotation, backup
validation, and production deployment as explicit operator actions.

## Before deploying migration 015

1. Schedule a maintenance window and pause inbound webhooks, payment callbacks,
   background jobs, and application writes.
2. Take a database backup and perform a restore rehearsal in an isolated
   project. A backup without a successful restore test is not considered
   verified.
3. Run the preflight section of
   `supabase/migrations/015_security_hardening.sql` against a staging copy. The
   migration aborts on missing schema, ambiguous tenant ownership, duplicate
   routing keys, duplicate payment identities, or invalid cron locks. Resolve
   those findings from authoritative records; do not delete an arbitrary row.
4. Confirm every `customer_profiles` and `push_subscriptions` row belongs to an
   existing tenant. In particular, never infer ownership from a phone number
   alone: the same customer can legitimately contact multiple tenants.
5. Confirm there is exactly one `config` row per tenant and at most one tenant
   for each non-empty `whatsapp_phone_id`.

## Coordinated application change

Migration 015 replaces the global `customer_profiles(phone_number)` primary key
with an `id` primary key and a unique `(tenant_id, phone_number)` identity. Any
customer-profile read must filter by both fields, and every upsert must use:

```text
onConflict: 'tenant_id,phone_number'
```

The old application uses `onConflict: 'phone_number'`, which becomes invalid as
soon as the migration commits. Keep webhooks paused while applying the
migration and deploying the compatible application version, then run a scoped
read/upsert smoke test before resuming traffic.

Migration 015 also adds `tenants.session_version`. Authentication code must copy
the current value into newly issued JWTs, compare it with the database on every
authenticated request, and atomically increment it after a password or other
security-sensitive credential change. The column alone does not revoke tokens.

The new `webhook_events` table and its `claim_webhook_event` /
`complete_webhook_event` functions provide the atomic receipt state machine.
Deploy the migration before the webhook code; the handlers intentionally fail
closed while those RPCs are unavailable. Receipts retain only a SHA-256 of the
raw payload, not webhook secrets or the sensitive raw payload.

The cron workers now retain `cron_locks.owner_token` and release by both name and
token. Deploy migration 015 before that code as well; a missing column causes
the cron to stop instead of running without mutual exclusion.

PayPhone processing now accepts only `POST` requests whose raw body has a valid
HMAC-SHA256 in `X-PayPhone-Signature-256`, using the deployment-only
`PAYPHONE_WEBHOOK_SECRET` (at least 32 random bytes). Configure a trusted PayPhone-capable gateway to
verify the provider callback and attach this internal signature if the provider
cannot emit that header itself. Browser `GET` redirects are deliberately
non-mutating and return 405. Payment confirmation no longer sends WhatsApp
directly; add a transactional outbox and an idempotent sender before restoring
that notification.

## Deployment and verification

1. Apply the migration to staging first. Capture the exact migration output and
   schema diff.
2. Verify direct `anon` and `authenticated` access to `push_subscriptions`,
   `customer_profiles`, and `webhook_events` is denied. Verify authorized API
   operations still work through the service role and remain tenant-scoped.
3. Replay the same signed payment/webhook fixture twice. Verify there is one
   receipt, one payment identity, and one set of business side effects.
4. Race two attempts to create the same tenant/customer and tenant/conversation
   identities. Verify the database preserves one identity and the application
   handles the unique-conflict path without returning another tenant's data.
5. Race two cron workers. Verify only the token owner can release its lock after
   a stale worker resumes.
6. Apply to production only after staging passes, then run the same smoke tests
   with non-destructive test records and monitor errors before resuming traffic.

## Storage migration 017

Migration `017_storage_buckets.sql` is the source of truth for the
`knowledge-base`, `chat_media`, and `uploads` buckets. It makes all three
private, reapplies their object-size and MIME allowlists, enables RLS, denies
direct `anon`/`authenticated` table access, and keeps only the server-side
`service_role` grants used by this application. Application routes must never
create or make a bucket public at runtime.

Before applying 017 to an existing project:

1. Export the bucket metadata, policies, and an object inventory. Confirm that
   no other application depends on direct browser access to the Storage schema;
   the grant revocation is intentionally project-wide and fail-closed.
2. Search `announcements.image_url` and `creative_templates.preview_image_url`
   for legacy `/storage/v1/object/public/uploads/` URLs. Convert each verified
   object key to the stable application URL
   `/api/assets/uploads/<object-key>` before making `uploads` private. Do not
   rewrite arbitrary external image URLs.
3. Deploy the application version that no longer calls `createBucket` and that
   serves only `announcements/` images through the public asset route. Configure
   `APP_URL` as the canonical HTTPS origin; production uploads fail closed when
   it is absent. In a new environment, apply the full migration chain before
   starting the application.
4. Apply 017 in staging and assert that direct Storage API requests with both
   `anon` and authenticated user tokens cannot list, read, upload, update, or
   delete objects in the three managed buckets.
5. Run service-role smoke tests for: knowledge upload/list/delete, chat-media
   upload plus signed-URL read, admin image upload, and readback through the
   application asset URL. Test files at and just above 5 MiB, 10 MiB, and
   16 MiB, plus a disallowed MIME type for each bucket.
6. Repeat the same checks after production deployment. A missing bucket or
   Storage error must return a failure; it must never trigger runtime bucket
   creation or silently report a successful upload.

## Knowledge metadata migration 020

Migration `020_knowledge_documents.sql` replaces each tenant's mutable Storage
`index.json` with transactional metadata in `public.knowledge_documents`.
Storage remains private and contains only the raw objects; the SQL row is the
authoritative source for listings, active state, extracted content, and object
ownership. Replacements use a new versioned object path, atomically switch the
metadata row, and record the old path in `knowledge_storage_cleanup`. Deletes
use a `delete_pending` state and are reported as successful only after both the
private object removal and SQL completion have succeeded.

The compatibility import is intentionally non-destructive. On the first
knowledge request for a tenant, the server validates the legacy `index.json`,
verifies every referenced raw object and its size, imports the complete set in
one SQL transaction, and writes one `knowledge_index_imports` receipt. It does
not edit or delete `index.json` or any referenced object. A malformed index,
duplicate identity, missing object, unsupported legacy ID, or ambiguous tenant
causes a 503 and no import receipt; the application never guesses or silently
imports a partial set.

Use this staging procedure:

1. Apply migration 017 first, take a verified database backup, and export an
   inventory plus offline copy of every `knowledge-base/<tenant>/index.json`
   and `knowledge-base/<tenant>/files/*` object. Do not place extracted content
   or customer data in tickets or build logs.
2. Apply 020 in staging before deploying the new API. Verify direct `anon` and
   `authenticated` access to all three new tables and all six functions is
   denied, while the service role can execute the scoped RPCs.
3. Before sending write traffic, deploy every knowledge reader together with
   the table-backed contract. `index.json` is a retained migration snapshot and
   is not updated after cutover; a reader that still treats it as live will not
   see new uploads. Search the deployed revision for `index.json` and test the
   chatbot/test endpoint as well as the panel.
4. Trigger one GET per staging tenant and compare the receipt counts, document
   names, active flags, extracted content hashes, and raw object paths against
   the exported inventory. If validation fails, repair the offline copy from
   authoritative records, restore the missing private object if appropriate,
   and retry. Do not create a receipt or delete the legacy index manually to
   bypass a failed validation.
5. Race uploads of the same file name and confirm there is one metadata row,
   the winning version is readable, and superseded objects are either removed
   or remain in the durable cleanup ledger. Simulate a metadata write failure
   after raw upload and confirm the unreferenced new object is compensated.
6. Simulate Storage failure during DELETE: the API must return a failure, keep
   a retryable `delete_pending` row, and complete on a later retry without
   exposing the private object. Also exercise PATCH and DELETE with a valid ID
   belonging to another tenant and confirm a 404 without data disclosure.
7. Monitor pending cleanup age/count and import failures during rollout. Do not
   remove the legacy snapshots until the retention period is approved, every
   tenant has a verified receipt, and all production readers use the SQL table.

There is no safe automatic remote backfill in this repository because object
contents live in Supabase Storage rather than PostgreSQL. The application-side
import is the controlled backfill. If a tenant cannot pass it, reconcile that
tenant manually in staging from the exported inventory and use the
service-role import RPC with validated JSON; never infer tenant ownership from
an object name alone. A rollback to the old code would omit documents created
after cutover because the legacy index is no longer written, so keep writes
paused and roll forward instead of reconstructing `index.json` during an
incident.

## Credential incident actions

If a secret has ever been committed, deleting it from the latest tree is not
enough. Rotate/revoke it at the provider, update the deployment secret store,
invalidate dependent sessions or tokens, and remove it from Git history using a
coordinated history rewrite. Notify every collaborator to re-clone afterward.
Do not paste secret values into tickets, logs, migration files, or this runbook.

## Durable WhatsApp ingress migration 018

Apply `018_whatsapp_ingress.sql` before deploying the asynchronous WhatsApp
webhook. The public callback now verifies Meta's HMAC and durably enqueues every
valid message found across all `entry` and `changes` arrays before returning a
200 response. If PostgreSQL is unavailable, it returns 503 so Meta can retry;
it never acknowledges a message that was not persisted or already present.

Configure `WHATSAPP_APP_SECRET`, `CRON_SECRET`, `WHATSAPP_WORKER_SECRET`, and an
HTTPS `APP_URL` as Vercel Sensitive environment variables. Keep every value
server-only. `WHATSAPP_WORKER_SECRET` may fall back to `CRON_SECRET` for legacy
deployments, but an independent value is preferred. The public callback uses
`after()` to start the worker immediately with `CRON_SECRET` after acknowledging
Meta. This is the normal low-latency path.

Vercel Hobby cannot deploy the previous every-minute cron. The free fallback is
`.github/workflows/whatsapp-worker.yml`, scheduled every five minutes. GitHub
does not store a shared secret: each run requests a short-lived OIDC JWT and
posts it directly to `/api/cron/whatsapp`. The route verifies GitHub's RS256
signature against its fixed HTTPS JWKS endpoint, exact issuer and audience, the
immutable repository and owner IDs, immutable subject, `main` ref, exact
workflow path, GitHub-hosted runner, and the `schedule`/`workflow_dispatch`
event allowlist. All other repositories, branches, workflows, and events fail
closed. The JWT is never persisted or logged.

The worker and webhook have a 60-second Hobby limit. The worker reserves a
45-second run budget, caps an internal processor request at 42 seconds, refuses
new claims when fewer than 10 seconds remain, and uses 120-second database
leases so a terminated invocation becomes recoverable quickly. GitHub schedules can be delayed or
dropped during high load and are disabled in public repositories after 60 days
without repository activity. Therefore the OIDC schedule is a recovery path,
not a real-time SLA; keep the immediate Vercel trigger enabled. The worker route
also fails closed when a required secret, canonical origin, or queue dependency
is unavailable.

The OIDC trust policy intentionally fixes `https://rifx-marketing.com` as both
audience and destination. If the production domain, repository owner/name, or
workflow path changes, update the workflow and `lib/github-actions-oidc.ts`
together and rerun the security suite. Protect `main` and require 2FA for every
account with write access.

Verify this flow in staging before enabling the Meta callback:

1. Send a signed fixture containing multiple entries, changes, and messages.
   Confirm each provider message ID creates exactly one `whatsapp_ingress` row.
2. Replay the exact fixture concurrently and confirm only duplicate counters
   change. Replay one provider ID with altered content and confirm HTTP 409.
3. Stop a worker after it claims an item, wait at least 120 seconds for the
   lease to expire, and confirm another worker reclaims it. Confirm repeated
   failures back off and reach `dead` after eight attempts rather than retrying
   forever.
4. Race two workers and verify `FOR UPDATE SKIP LOCKED` prevents concurrent
   ownership. For a successful reply, confirm one `whatsapp_outbound_deliveries`
   receipt reaches `sent` and a replay does not call Meta again.
5. Alert on `dead` rows, oldest queued age, repeated 503 responses, and queue
   growth. The current worker handles at most three messages per invocation;
   increase scheduled concurrency only after a tenant-isolation and provider
   rate-limit test.

The queue payload contains customer message PII required by the existing bot.
Restrict it to the service role and purge completed/dead envelopes according to
the approved retention policy; migration 018 deliberately does not guess that
policy. Meta's send API has no application idempotency key. A timeout after
Meta accepted a message but before its response arrived can therefore still
produce a duplicate on retry. The outbound receipt closes duplicates once a
successful provider response is recorded, but it cannot close that ambiguous
network window. Calendar, payment-link, and other legacy external side effects
inside the processor are also not yet transactional outboxes; exercise their
recovery paths before declaring exactly-once processing.

## Durable social publication migration 021

Apply `021_social_worker_hardening.sql` before deploying the social publisher,
scheduler, tracker, or health changes. It adds atomic worker and dispatcher
claims, token-owned leases, bounded retries with exponential backoff, a
database dead-letter state, and aggregate health. Existing `processing` rows
are intentionally moved to `dead`: the provider may already have accepted
them, so replaying them automatically could create a duplicate post.

Production requires all of these deployment secrets:

```text
APP_URL=https://the-canonical-origin.example
CRON_SECRET=<independent random secret>
SOCIAL_WORKER_SECRET=<at least 32 random bytes>
QSTASH_TOKEN=<QStash API token>
QSTASH_CURRENT_SIGNING_KEY=<QStash receiver current key>
QSTASH_NEXT_SIGNING_KEY=<QStash receiver next key>
```

Create one QStash schedule with cron expression `* * * * *`, method `POST`,
destination `${APP_URL}/api/cron/messages`, and forwarded header
`Authorization: Bearer <CRON_SECRET>`. Confirm in the QStash console that the
deployment plan accepts the application's explicit four retries, 55-second
destination timeout, and flow-control headers. The application deliberately
does not infer that a schedule exists from the presence of a token. A missing
or paused schedule is therefore a production gate, not an application default.
QStash signs each per-publication delivery; the worker verifies the JWT issuer,
expiry/not-before, canonical destination, raw-body digest, current/next signing
key, and the independent forwarded worker secret. See the official
[QStash signing contract](https://upstash.com/docs/qstash/features/security) and
[publish headers](https://upstash.com/docs/qstash/api-reference/messages/publish-a-message).

The deployed Next.js worker is a synchronous Netlify Function. Netlify's fixed
limits are currently 60 seconds for synchronous functions, 30 seconds for
scheduled functions, and 15 minutes for background functions; `maxDuration`
does not turn this route into a background function. The worker therefore
stops provider work at 45 seconds so it can persist a final state before the
platform terminates it. Verify these limits against the current
[Netlify function configuration](https://docs.netlify.com/build/functions/configuration/)
for the target account before every launch.

This boundary creates an exact operational gate: before enabling social
publishing, exercise the maximum permitted fixture for Facebook, Instagram,
YouTube, and TikTok and prove each provider call completes inside 45 seconds.
Instagram transcoding or a 100 MiB binary upload may exceed that budget. If any
fixture does, move provider execution to a true Netlify Background Function or
an external durable worker and persist provider upload/container session state
before enabling that platform. Do not simply raise the route timeout. TikTok
and YouTube both document resumable/chunked transfer semantics that should be
used by that long-running implementation: [TikTok media transfer](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide)
and [YouTube resumable uploads](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol).

Run these staging checks after applying 021:

1. Race two schedulers and two worker deliveries for the same publication.
   Confirm one dispatcher lease and one provider claim win.
2. Kill a worker before `mark_social_provider_started`; after lease expiry,
   confirm it moves to `retry` with backoff. Kill it after that marker and
   confirm it moves to `dead` with `expired_provider_lease_ambiguous` instead
   of calling the provider again.
3. Replay a valid QStash body/signature, then alter the body, destination,
   signature, forwarded secret, and signing key separately. Only the exact
   signed delivery may pass.
4. Force 429/5xx responses before provider acceptance and confirm bounded
   retries reach `dead`. Force a lost response during the final publish step
   and confirm manual reconciliation is required.
5. Verify `/api/cron/health` reports due age, expired leases, and dead-letter
   count and returns unhealthy while any dead-letter needs attention. Alert on
   all three signals and on consecutive `messages` cron failures.
6. Inspect QStash logs to confirm the forwarded worker secret is redacted and
   review QStash DLQ alongside the database dead-letter queue.

Database claims are idempotent, but the external providers do not share one
universal idempotency contract. An ambiguous final network response is thus
made terminal and requires provider-side reconciliation. Resolve it by finding
the remote media, recording its ID and closing the row through an audited
operator procedure; never reset `dead` to `pending` blindly. Ambiguous rows
retain their R2 object for that investigation.

## Rollback boundary

Do not improvise a production rollback that recreates the global phone-number
key: doing so can collapse valid profiles from different tenants. If migration
015 fails, its explicit transaction rolls back. If the application deployment
fails after the migration commits, keep writes paused and roll the application
forward to the tenant-scoped contract. Restore the verified backup only under
the incident plan if data integrity cannot otherwise be preserved.
