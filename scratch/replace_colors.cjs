const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'panel', 'panel-client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find the dashboard section
const startIndex = content.indexOf(`key="dashboard"`);
const endIndex = content.indexOf(`activeTab === 'crm'`);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find bounds");
  process.exit(1);
}

let dashboardContent = content.substring(startIndex, endIndex);

// Perform color replacements
const replacements = [
  { from: /bg-\[#007AFF\]/g, to: 'bg-primary-container' },
  { from: /text-\[#007AFF\]/g, to: 'text-primary-container' },
  { from: /decoration-\[#007AFF\]/g, to: 'decoration-primary-container' },
  { from: /bg-\[#E11D48\]/g, to: 'bg-on-tertiary-container text-white' }, // "Nuevo" badge
  { from: /bg-\[#4F46E5\]/g, to: 'bg-primary text-white' },
  { from: /hover:bg-\[#4F46E5\]\/90/g, to: 'hover:bg-primary/90' },
  { from: /bg-\[#F8FAFC\]/g, to: 'bg-crm-surface-container-low' },
  
  // Blue variations
  { from: /bg-blue-100/g, to: 'bg-primary-container/20' },
  { from: /text-blue-600/g, to: 'text-primary-container' },
  { from: /text-blue-700/g, to: 'text-primary' },
  { from: /bg-blue-50/g, to: 'bg-primary-container/10' },
  { from: /border-blue-100/g, to: 'border-primary-container/20' },
  { from: /text-blue-100/g, to: 'text-primary-container/20' },
  { from: /border-blue-50/g, to: 'border-primary-container/10' },
  { from: /hover:border-blue-200/g, to: 'hover:border-primary-container/30' },

  // Orange variations (Using tertiary colors from theme)
  { from: /bg-orange-500/g, to: 'bg-tertiary-container' },
  { from: /text-orange-600/g, to: 'text-on-tertiary-container' },
  { from: /text-orange-700/g, to: 'text-on-tertiary-container' },
  { from: /bg-orange-100/g, to: 'bg-tertiary-container/30' },
  { from: /text-orange-100/g, to: 'text-tertiary-container/30' },
  { from: /border-orange-100/g, to: 'border-tertiary-container/20' },
  { from: /bg-orange-50\/30/g, to: 'bg-tertiary-container/5' },
  { from: /bg-orange-50/g, to: 'bg-tertiary-container/10' },
];

replacements.forEach(rep => {
  dashboardContent = dashboardContent.replace(rep.from, rep.to);
});

content = content.substring(0, startIndex) + dashboardContent + content.substring(endIndex);
fs.writeFileSync(filePath, content);
console.log("Colors replaced successfully!");
