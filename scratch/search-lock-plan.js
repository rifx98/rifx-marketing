import fs from 'fs';

const filePath = 'c:/Users/x/OneDrive/Escritorio/rifx-marketing.github.io-main/app/panel/panel-client.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes("getRequiredPlanForTab") || line.includes("isTabLocked")) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    // Print 15 lines below
    for (let i = index; i < index + 25; i++) {
      if (lines[i] !== undefined) {
        console.log(`  ${i + 1}: ${lines[i]}`);
      }
    }
  }
});
