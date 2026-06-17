const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'panel', 'panel-client.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('handleSaveSettings')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
