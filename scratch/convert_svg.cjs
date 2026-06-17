const sharp = require('sharp');
const fs = require('fs');

async function convertSvgToPng() {
  try {
    const svgBuffer = fs.readFileSync('public/images/rifx-logo-user.svg');
    await sharp(svgBuffer)
      .png()
      .toFile('public/images/rifx-logo-particles-clean.png');
    console.log('Successfully converted SVG to PNG!');
  } catch (err) {
    console.error('Error converting SVG:', err);
  }
}

convertSvgToPng();
