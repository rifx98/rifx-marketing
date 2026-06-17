const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', 'home-client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Ensure import is added
if (!content.includes("import FunnelSection")) {
  content = content.replace("import EntryAnimation from './components/EntryAnimation';", "import EntryAnimation from './components/EntryAnimation';\nimport FunnelSection from './components/FunnelSection';");
}

// Replace the old funnel section
const funnelStart = content.indexOf('        {/* Services Section — Embudo de Ventas Zig-Zag */}');
const funnelEnd = content.indexOf('        {/* Testimonials Section */}');

if (funnelStart !== -1 && funnelEnd !== -1) {
  const newFunnel = `        <FunnelSection />\n\n`;
  content = content.substring(0, funnelStart) + newFunnel + content.substring(funnelEnd);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("Successfully swapped funnel to the new sticky component!");
} else {
  console.log("Could not find funnel section markers", { funnelStart, funnelEnd });
}
