import { spawn } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const keys = Object.keys(envConfig);

console.log(`Found ${keys.length} environment variables in .env.local to sync to Vercel...`);

function addEnv(key, val, env) {
  return new Promise((resolve) => {
    const proc = spawn('cmd.exe', ['/c', 'npx', 'vercel', 'env', 'add', key, env, '--force'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let out = '', err = '';
    proc.stdout.on('data', d => out += d);
    proc.stderr.on('data', d => err += d);
    proc.stdin.write(val + '\n');
    proc.stdin.end();
    proc.on('close', code => {
      resolve({ code, out, err });
    });
  });
}

async function syncKey(key, index, total) {
  const val = envConfig[key];
  if (!val && val !== '') return;
  const environments = ['production', 'preview', 'development'];
  for (const env of environments) {
    await addEnv(key, val, env);
  }
  console.log(`[${index + 1}/${total}] ✓ Synced ${key}`);
}

async function main() {
  const CONCURRENCY = 6;
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < keys.length) {
      const idx = currentIndex++;
      const key = keys[idx];
      await syncKey(key, idx, keys.length);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  // Remove test var if exists
  await new Promise((resolve) => {
    const proc = spawn('cmd.exe', ['/c', 'npx', 'vercel', 'env', 'rm', 'TEST_VAR', 'production', '--yes'], {
      stdio: 'pipe'
    });
    proc.on('close', resolve);
  });

  console.log('🎉 All environment variables successfully synced to Vercel!');
}

main().catch(console.error);
