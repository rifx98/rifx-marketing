import fs from 'fs';
import path from 'path';

const filePath = 'c:/Users/x/OneDrive/Escritorio/rifx-marketing.github.io-main/app/panel/panel-client.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);

// Search for activeTab or similar
const queries = ['activeTab', 'allowedTabs', 'sidebar', 'Tab', 'tab', 'Settings'];

queries.forEach(query => {
  console.log(`\n--- Matches for "${query}" ---`);
  let count = 0;
  lines.forEach((line, index) => {
    if (line.includes(query) && count < 20) {
      console.log(`${index + 1}: ${line.trim()}`);
      count++;
    }
  });
});
