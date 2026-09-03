const fs = require('fs');
const path = require('path');
const file = path.join('app', 'panel', 'panel-client.tsx');
let content = fs.readFileSync(file, 'utf8');

const startMarker = "              {/* Right Column: WhatsApp Phone Mockup */}";
const endMarker = "            </div>{/* end grid grid-cols-12 */}";

const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
  console.error("Start marker not found.");
  process.exit(1);
}

const endIndex = content.indexOf(endMarker, startIndex);
if (endIndex === -1) {
  console.error("End marker not found.");
  process.exit(1);
}

// Remove the block
content = content.substring(0, startIndex) + content.substring(endIndex);

// Also change the left column to full width: lg:col-span-12
// The left column starts with: <div className="col-span-12 lg:col-span-6 space-y-8">
content = content.replace(
  '<div className="col-span-12 lg:col-span-6 space-y-8">',
  '<div className="col-span-12 lg:col-span-12 space-y-8">'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Success!');
