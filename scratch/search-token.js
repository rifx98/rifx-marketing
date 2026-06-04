import fs from 'fs';

const filePath = 'c:/Users/x/OneDrive/Escritorio/rifx-marketing.github.io-main/app/panel/panel-client.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes("Authorization") || line.includes("token") || line.includes("localStorage")) {
    if (line.includes("Headers") || line.includes("Bearer") || line.includes("fetch(")) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  }
});
