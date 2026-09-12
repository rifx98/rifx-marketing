import fs from 'fs';
import { spawn } from 'child_process';

const googleClientId = '671540501780-2r133l4e2an246lta9mtns64um046kcn.apps.googleusercontent.com';

let content = fs.readFileSync('.env.local', 'utf8');
content = content.replace(/^NEXT_PUBLIC_GOOGLE_CLIENT_ID=.*$/m, `NEXT_PUBLIC_GOOGLE_CLIENT_ID="${googleClientId}"`);
fs.writeFileSync('.env.local', content);
console.log('✓ Updated NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local');

function addEnv(key, val, env) {
  return new Promise((resolve) => {
    const proc = spawn('cmd.exe', ['/c', 'npx', 'vercel', 'env', 'add', key, env, '--force'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    proc.stdin.write(val + '\n');
    proc.stdin.end();
    proc.on('close', resolve);
  });
}

async function main() {
  const environments = ['production', 'preview', 'development'];
  for (const env of environments) {
    await addEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', googleClientId, env);
    console.log(`✓ Synced NEXT_PUBLIC_GOOGLE_CLIENT_ID to Vercel (${env})`);
  }
  console.log('🎉 Google Client ID configured and synced to Vercel successfully!');
}

main().catch(console.error);
