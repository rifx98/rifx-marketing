const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'panel', 'panel-client.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 8220; i <= 8250; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
