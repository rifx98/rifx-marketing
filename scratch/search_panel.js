import fs from 'fs';
import path from 'path';

function main() {
  const query = process.argv[2] || 'admin';
  const filePath = path.resolve('app/panel/panel-client.tsx');
  if (!fs.existsSync(filePath)) {
    console.log("File not found:", filePath);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let found = 0;
  console.log(`Searching for "${query}" in ${filePath}...`);
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(query.toLowerCase())) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
      found++;
      if (found >= 100) {
        console.log("Truncating after 100 matches...");
        process.exit(0);
      }
    }
  });
  console.log(`Found ${found} occurrences.`);
}

main();
