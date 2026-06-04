import OpenAI from 'openai';
import fs from 'fs';

// Parse .env.local manually in case node version doesn't support --env-file
let apiKey = process.env.OPENAI_API_KEY;
if (!apiKey && fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  const match = content.match(/OPENAI_API_KEY\s*=\s*(.*)/);
  if (match) {
    apiKey = match[1].trim().replace(/^['"]|['"]$/g, '');
  }
}
if (!apiKey && fs.existsSync('.env')) {
  const content = fs.readFileSync('.env', 'utf8');
  const match = content.match(/OPENAI_API_KEY\s*=\s*(.*)/);
  if (match) {
    apiKey = match[1].trim().replace(/^['"]|['"]$/g, '');
  }
}

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY not found in env, .env, or .env.local');
  process.exit(1);
}

console.log(`🔑 Using API Key starting with: ${apiKey.substring(0, 10)}...`);

const openai = new OpenAI({ apiKey });

async function main() {
  try {
    console.log('📡 Fetching models from OpenAI...');
    const response = await openai.models.list();
    const models = response.data.map(m => m.id).sort();
    console.log('✅ Available Models:');
    models.forEach(id => console.log(` - ${id}`));
  } catch (err) {
    console.error('❌ Error listing models:', err.message);
  }
}

main();
