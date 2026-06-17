const fs = require('fs');

let homeContent = fs.readFileSync('app/home-client.tsx', 'utf-8');

if (!homeContent.includes('ScrollyContainer')) {
  homeContent = homeContent.replace(
    'import TrainCTA from \'./components/TrainCTA\';',
    'import TrainCTA from \'./components/TrainCTA\';\nimport { ScrollyContainer } from \"./components/ScrollyContainer\";'
  );
}

// Envolver las secciones dentro de <main>
// Todas las <section> y <FunnelSection /> y <TrainCTA />
// O podemos envolver desde {/* Hero Section */} hasta el final de TrainCTA

const startHero = homeContent.indexOf('{/* Hero Section */}');
const endMain = homeContent.indexOf('</main>');

if (startHero !== -1 && endMain !== -1) {
  const before = homeContent.substring(0, startHero);
  const sections = homeContent.substring(startHero, endMain);
  const after = homeContent.substring(endMain);

  const newContent = before + '<ScrollyContainer>\n' + sections + '</ScrollyContainer>\n' + after;
  fs.writeFileSync('app/home-client.tsx', newContent, 'utf-8');
  console.log('Successfully applied ScrollyContainer');
} else {
  console.log('Could not find boundaries');
}
