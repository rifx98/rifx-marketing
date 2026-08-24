import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const GITHUB_ACTIONS_ISSUER = 'https://token.actions.githubusercontent.com';
const GITHUB_ACTIONS_JWKS_URL = `${GITHUB_ACTIONS_ISSUER}/.well-known/jwks`;

export const GITHUB_ACTIONS_OIDC_AUDIENCE = 'https://rifx-marketing.com/api/cron/whatsapp';
export const GITHUB_ACTIONS_OIDC_SUBJECT =
  'repo:rifx98@278632563/rifx-marketing@1338953941:ref:refs/heads/main';

const EXPECTED_CLAIMS = {
  repository: 'rifx98/rifx-marketing',
  repository_id: '1338953941',
  repository_owner: 'rifx98',
  repository_owner_id: '278632563',
  ref: 'refs/heads/main',
  ref_type: 'branch',
  workflow_ref:
    'rifx98/rifx-marketing/.github/workflows/whatsapp-worker.yml@refs/heads/main',
  runner_environment: 'github-hosted',
} as const;

const ALLOWED_EVENTS = new Set(['schedule', 'workflow_dispatch']);
const MAX_TOKEN_BYTES = 8 * 1024;
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

// The origin is fixed rather than derived from request data, so key discovery
// cannot be redirected to an attacker-controlled host. jose caches successful
// key sets and rate-limits refreshes for unknown key IDs.
const githubActionsJwks = createRemoteJWKSet(new URL(GITHUB_ACTIONS_JWKS_URL), {
  timeoutDuration: 3_000,
  cooldownDuration: 30_000,
  cacheMaxAge: 10 * 60_000,
});

export function hasTrustedGitHubActionsClaims(payload: JWTPayload): boolean {
  if (
    payload.iss !== GITHUB_ACTIONS_ISSUER
    || payload.aud !== GITHUB_ACTIONS_OIDC_AUDIENCE
    || payload.sub !== GITHUB_ACTIONS_OIDC_SUBJECT
    || typeof payload.jti !== 'string'
    || payload.jti.length === 0
    || payload.jti.length > 256
    || !Number.isSafeInteger(payload.iat)
    || !Number.isSafeInteger(payload.nbf)
    || !Number.isSafeInteger(payload.exp)
  ) return false;

  for (const [claim, expected] of Object.entries(EXPECTED_CLAIMS)) {
    if (payload[claim] !== expected) return false;
  }

  return typeof payload.event_name === 'string' && ALLOWED_EVENTS.has(payload.event_name);
}

export async function verifyGitHubActionsOidcToken(token: string | null): Promise<boolean> {
  if (
    !token
    || Buffer.byteLength(token, 'utf8') > MAX_TOKEN_BYTES
    || !JWT_PATTERN.test(token)
  ) return false;

  try {
    const { payload } = await jwtVerify(token, githubActionsJwks, {
      issuer: GITHUB_ACTIONS_ISSUER,
      audience: GITHUB_ACTIONS_OIDC_AUDIENCE,
      algorithms: ['RS256'],
      typ: 'JWT',
      clockTolerance: 5,
      maxTokenAge: '10 minutes',
      requiredClaims: [
        'exp',
        'nbf',
        'iat',
        'jti',
        'sub',
        'repository',
        'repository_id',
        'repository_owner',
        'repository_owner_id',
        'ref',
        'ref_type',
        'workflow_ref',
        'event_name',
        'runner_environment',
      ],
    });
    return hasTrustedGitHubActionsClaims(payload);
  } catch {
    // Authentication failures are intentionally indistinguishable and never
    // log the bearer token or JOSE error details.
    return false;
  }
}
