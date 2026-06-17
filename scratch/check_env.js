import fs from 'fs';
import path from 'path';

function main() {
  const envPath = path.resolve('.env.local');
  if (!fs.existsSync(envPath)) {
    console.log(".env.local does not exist!");
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  console.log("=== .env.local variables ===");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    const name = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    const safeVal = val.length > 8 ? `${val.substring(0, 4)}...${val.substring(val.length - 4)} (${val.length} chars)` : `${val} (${val.length} chars)`;
    console.log(`${name}: ${safeVal}`);
  }
}

main();
