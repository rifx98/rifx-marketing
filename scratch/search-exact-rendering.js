import fs from 'fs';

const filePath = 'c:/Users/x/OneDrive/Escritorio/rifx-marketing.github.io-main/app/panel/panel-client.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const queries = ["activeTab === 'billing'", "activeTab === 'analytics'"];
queries.forEach(query => {
  lines.forEach((line, index) => {
    if (line.includes(query)) {
      console.log(`Match for "${query}" on line ${index + 1}:`);
      for (let i = index - 10; i < index + 30; i++) {
        if (lines[i] !== undefined) {
          console.log(`  ${i + 1}: ${lines[i]}`);
        }
      }
    }
  });
});
