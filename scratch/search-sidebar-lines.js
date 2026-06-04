import fs from 'fs';

const filePath = 'c:/Users/x/OneDrive/Escritorio/rifx-marketing.github.io-main/app/panel/panel-client.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes("key: 'campaigns'") || line.includes("key: 'banners'") || line.includes("key: 'billing'")) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
