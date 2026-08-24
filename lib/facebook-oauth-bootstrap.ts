const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const FACEBOOK_ID_PATTERN = /^\d{5,32}$/;
const MAX_OAUTH_STATE_LENGTH = 4_096;
const MAX_REDIRECT_URI_LENGTH = 2_048;
const MAX_PUBLIC_ERROR_LENGTH = 300;

type JsonObject = Record<string, unknown>;

export interface FacebookOAuthBootstrap {
  state: string;
  redirectUrl: URL;
  appId: string;
  configId: string;
}

interface ParseFacebookOAuthBootstrapOptions {
  responseOk: boolean;
  expectedOrigin: string;
  invalidMessage: string;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function boundedString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > maxLength ||
    CONTROL_CHARACTER_PATTERN.test(normalized)
  ) return '';
  return normalized;
}

function invalidBootstrap(message: string): never {
  throw new Error(message);
}

/**
 * Parses the same-origin OAuth bootstrap response before any provider URL is
 * constructed. Server errors are bounded, and redirect data fails closed on
 * malformed, cross-origin, credentialed, or decorated URLs.
 */
export function parseFacebookOAuthBootstrap(
  payload: unknown,
  options: ParseFacebookOAuthBootstrapOptions,
): FacebookOAuthBootstrap {
  const data = asObject(payload);
  const invalidMessage = boundedString(options.invalidMessage, MAX_PUBLIC_ERROR_LENGTH)
    || 'Invalid OAuth configuration.';
  const serverError = boundedString(data.error, MAX_PUBLIC_ERROR_LENGTH);

  if (!options.responseOk) invalidBootstrap(serverError || invalidMessage);

  const state = boundedString(data.state, MAX_OAUTH_STATE_LENGTH);
  const appId = boundedString(data.appId, 32);
  const rawRedirectUri = boundedString(data.redirectUri, MAX_REDIRECT_URI_LENGTH);
  const hasConfigId = data.configId !== undefined && data.configId !== null && data.configId !== '';
  const rawConfigId = hasConfigId ? boundedString(data.configId, 32) : '';

  if (
    !state ||
    !FACEBOOK_ID_PATTERN.test(appId) ||
    !rawRedirectUri ||
    (hasConfigId && !FACEBOOK_ID_PATTERN.test(rawConfigId))
  ) invalidBootstrap(serverError || invalidMessage);

  let expectedOrigin: URL;
  let redirectUrl: URL;
  try {
    expectedOrigin = new URL(options.expectedOrigin);
    redirectUrl = new URL(rawRedirectUri);
  } catch {
    invalidBootstrap(serverError || invalidMessage);
  }

  if (
    expectedOrigin.origin !== options.expectedOrigin ||
    redirectUrl.origin !== expectedOrigin.origin ||
    redirectUrl.pathname !== '/panel' ||
    redirectUrl.username ||
    redirectUrl.password ||
    redirectUrl.search ||
    redirectUrl.hash
  ) invalidBootstrap(serverError || invalidMessage);

  return { state, redirectUrl, appId, configId: rawConfigId };
}
