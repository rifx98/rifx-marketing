import fs from 'fs';

const filePath = 'c:/Users/x/OneDrive/Escritorio/rifx-marketing.github.io-main/app/panel/panel-client.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes("activeTab === 'admin'")) {
    console.log(`Found activeTab === 'admin' on line ${index + 1}`);
    for (let i = index - 10; i < index + 5; i++) {
      console.log(`  ${i + 1}: ${lines[i]}`);
    }
  }
});
