import http from 'node:http';
import { performance } from 'node:perf_hooks';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const entry = process.argv[index];
  if (!entry.startsWith('--')) continue;
  const [key, inlineValue] = entry.slice(2).split('=', 2);
  const value = inlineValue ?? (process.argv[index + 1]?.startsWith('--') ? 'true' : process.argv[++index]) ?? 'true';
  args.set(key, value);
}

const selfTest = args.get('self-test') === 'true';
const concurrency = Math.min(100, Math.max(1, Number(args.get('concurrency') || 10)));
const durationSeconds = Math.min(60, Math.max(1, Number(args.get('duration') || 3)));
const timeoutMs = Math.min(10_000, Math.max(250, Number(args.get('timeout') || 3_000)));

let fixtureServer;
let target;
if (selfTest) {
  fixtureServer = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end('{"ok":true,"fixture":true}');
  });
  await new Promise((resolve, reject) => {
    fixtureServer.once('error', reject);
    fixtureServer.listen(0, '127.0.0.1', resolve);
  });
  const address = fixtureServer.address();
  target = new URL(`http://127.0.0.1:${address.port}/health`);
} else {
  target = new URL(args.get('url') || 'http://127.0.0.1:3000/');
}

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
if (target.protocol !== 'http:' || !loopbackHosts.has(target.hostname)) {
  fixtureServer?.close();
  throw new Error('Safety stop: this harness only permits HTTP loopback targets');
}

const latencies = [];
const statuses = new Map();
let failures = 0;
let requests = 0;
const startedAt = performance.now();
const deadline = startedAt + durationSeconds * 1000;

async function worker() {
  while (performance.now() < deadline) {
    const requestStarted = performance.now();
    try {
      const response = await fetch(target, {
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      await response.arrayBuffer();
      statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
      if (!response.ok) failures += 1;
    } catch {
      failures += 1;
    } finally {
      latencies.push(performance.now() - requestStarted);
      requests += 1;
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const elapsedSeconds = (performance.now() - startedAt) / 1000;
latencies.sort((left, right) => left - right);
const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] || 0;

const result = {
  targetKind: selfTest ? 'harness-fixture' : 'local-application',
  target: target.toString(),
  concurrency,
  durationSeconds: Number(elapsedSeconds.toFixed(2)),
  requests,
  requestsPerSecond: Number((requests / elapsedSeconds).toFixed(2)),
  failures,
  errorRatePercent: Number(((failures / Math.max(1, requests)) * 100).toFixed(3)),
  latencyMs: {
    p50: Number(percentile(0.50).toFixed(2)),
    p95: Number(percentile(0.95).toFixed(2)),
    p99: Number(percentile(0.99).toFixed(2)),
  },
  statuses: Object.fromEntries(statuses),
};

await new Promise((resolve) => fixtureServer ? fixtureServer.close(resolve) : resolve());
console.log(JSON.stringify(result, null, 2));
if (failures > 0) process.exitCode = 1;
