const fs = require('fs');

// 1. Rewrite home-client.tsx
let homeContent = fs.readFileSync('app/home-client.tsx', 'utf-8');

if (!homeContent.includes('ScrollyContainer')) {
  homeContent = homeContent.replace(
    'import { ContactChannels } from "./components/ContactChannels";',
    'import { ContactChannels } from "./components/ContactChannels";\nimport { ScrollyContainer } from "./components/ScrollyContainer";'
  );
}

const startIdx = homeContent.indexOf('<div className="relative z-10">');
const endIdx = homeContent.lastIndexOf('</main>');

if (startIdx !== -1 && endIdx !== -1) {
  const before = homeContent.substring(0, startIdx);
  const after = homeContent.substring(endIdx);
  
  let contentInside = homeContent.substring(startIdx + '<div className="relative z-10">'.length, endIdx);
  
  const lastDivIdx = contentInside.lastIndexOf('</div>');
  if (lastDivIdx !== -1) {
    contentInside = contentInside.substring(0, lastDivIdx) + contentInside.substring(lastDivIdx + 6);
  }
  
  const newHomeContent = before + '<ScrollyContainer>' + contentInside + '</ScrollyContainer>\n      ' + after;
  fs.writeFileSync('app/home-client.tsx', newHomeContent, 'utf-8');
}

// 2. Update ParticleCanvas.tsx to remove finalY vertical scroll math
let particleContent = fs.readFileSync('app/components/ParticleCanvas.tsx', 'utf-8');
particleContent = particleContent.replace(
  'baseFinalY = ry * 1.05 + (s * vhIn3D); // Sube',
  'baseFinalY = ry * 1.05;'
);
particleContent = particleContent.replace(
  'baseFinalY = ry * 1.05 + ((s - 1.0) * vhIn3D); // Entra desde abajo y se centra en s=1.0',
  'baseFinalY = ry * 1.05;'
);

fs.writeFileSync('app/components/ParticleCanvas.tsx', particleContent, 'utf-8');
console.log('Successfully updated home-client.tsx and ParticleCanvas.tsx');
