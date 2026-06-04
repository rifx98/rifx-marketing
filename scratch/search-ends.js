import fs from 'fs';

const filePath = 'c:/Users/x/OneDrive/Escritorio/rifx-marketing.github.io-main/app/panel/panel-client.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 9980; i < 10150; i++) {
  if (lines[i] !== undefined) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
