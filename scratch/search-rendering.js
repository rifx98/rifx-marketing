import fs from 'fs';

const filePath = 'c:/Users/x/OneDrive/Escritorio/rifx-marketing.github.io-main/app/panel/panel-client.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Searching for tab rendering sections...');

lines.forEach((line, index) => {
  if (line.includes("activeTab === '") || line.includes("activeTab === \"")) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
