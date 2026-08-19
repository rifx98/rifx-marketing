const EXACT_PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);

const PUSH_HOST_SUFFIXES = [
  '.push.services.mozilla.com',
  '.push.apple.com',
  '.notify.windows.com',
];

export function isAllowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 2_048) {
    return false;
  }

  try {
    const endpoint = new URL(value);
    const hostname = endpoint.hostname.toLowerCase();
    return endpoint.protocol === 'https:'
      && !endpoint.username
      && !endpoint.password
      && !endpoint.hash
      && (!endpoint.port || endpoint.port === '443')
      && (
        EXACT_PUSH_HOSTS.has(hostname)
        || PUSH_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
      );
  } catch {
    return false;
  }
}
