const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'panel', 'panel-client.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const query = 'test-ai';
const lines = content.split('\n');
let found = 0;
lines.forEach((line, index) => {
  if (line.includes(query)) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    found++;
  }
});
console.log(`Found ${found} occurrences.`);
