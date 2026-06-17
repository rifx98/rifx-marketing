const fs = require('fs');

// 1. Update ParticleCanvas.tsx
let content = fs.readFileSync('app/components/ParticleCanvas.tsx', 'utf-8');

// Update handleScroll to use innerHeight
content = content.replace(
    /const maxScroll = Math\.max\(1, document\.documentElement\.scrollHeight - window\.innerHeight\);\s*scrollY\.current = window\.scrollY \/ maxScroll;/g,
    `scrollY.current = window.scrollY / window.innerHeight;
      windowWidth.current = window.innerWidth;`
);

// Add windowWidth ref
if (!content.includes('const windowWidth = useRef(1024);')) {
    content = content.replace(
        'const scrollY = useRef(0);',
        `const scrollY = useRef(0);\n  const windowWidth = useRef(1024);`
    );
}

// Replace the useFrame logic
const oldUseFrame = `      let rx, ry, rz;
      let rotX = 0, rotY = 0, rotZ = 0;
      let scale = 1.07;
      let pLogo = phase === 0 ? pA : pB;

      if (phase === 0) {
        const localProgress = totalProgress / 0.5;
        const easeP = localProgress * localProgress;
        rx = pA.x; ry = pA.y; rz = pA.z;
        const windX = (pA.noise! - 0.5) * 110 * easeP;
        const windY = (Math.sin(pA.y + time) + (pA.noise! - 0.5)) * 80 * easeP;
        const windZ = (Math.cos(pA.x + time) + (pA.noise! - 0.5)) * 80 * easeP;
        rx += windX; ry += windY; rz += windZ;
        if (pA.hidden) scale = 0;
        else scale = 1.07 * (1.0 - easeP * 0.4);
        rotX += easeP * time * 2; rotY += easeP * time * 2; rotZ += easeP * time * 2;
      } else {
        const localProgress = (totalProgress - 0.5) / 0.5;
        const easeP = 1.0 - (localProgress * localProgress);
        rx = pB.x; ry = pB.y; rz = pB.z;
        const windX = (pB.noise! - 0.5) * 110 * easeP;
        const windY = (Math.sin(pB.y + time) + (pB.noise! - 0.5)) * 80 * easeP;
        const windZ = (Math.cos(pB.x + time) + (pB.noise! - 0.5)) * 80 * easeP;
        rx += windX; ry += windY; rz += windZ;
        if (pB.hidden) scale = 0;
        else scale = 1.07 * (1.0 - easeP * 0.4);
        rotX += easeP * time * 2; rotY += easeP * time * 2; rotZ += easeP * time * 2;
      }
      
      let finalX = rx * 1.05 + 18;
      let finalY = ry * 1.05;
      let finalZ = rz * 1.05;`;

const newUseFrame = `      let rx, ry, rz;
      let rotX = 0, rotY = 0, rotZ = 0;
      let scale = 1.07;
      let pLogo = phase === 0 ? pA : pB;
      
      const vhIn3D = 54; // Altura en unidades 3D de la cámara fov 60
      const isMobile = windowWidth.current < 1024;
      const logoOffsetX = isMobile ? 0 : 18;
      const alienOffsetX = isMobile ? 0 : -18;
      
      let baseFinalX, baseFinalY;

      if (phase === 0) {
        const localProgress = totalProgress / 0.5;
        const easeP = localProgress * localProgress;
        rx = pA.x; ry = pA.y; rz = pA.z;
        const windX = (pA.noise! - 0.5) * 150 * easeP;
        const windY = (Math.sin(pA.y + time) + (pA.noise! - 0.5)) * 120 * easeP;
        const windZ = (Math.cos(pA.x + time) + (pA.noise! - 0.5)) * 120 * easeP;
        rx += windX; ry += windY; rz += windZ;
        if (pA.hidden) scale = 0;
        else scale = 1.07 * (1.0 - easeP * 0.4);
        rotX += easeP * time * 2; rotY += easeP * time * 2; rotZ += easeP * time * 2;
        
        baseFinalX = rx * 1.05 + logoOffsetX;
        baseFinalY = ry * 1.05 + (s * vhIn3D); // Sube
      } else {
        const localProgress = (totalProgress - 0.5) / 0.5;
        const easeP = 1.0 - (localProgress * localProgress);
        rx = pB.x; ry = pB.y; rz = pB.z;
        const windX = (pB.noise! - 0.5) * 150 * easeP;
        const windY = (Math.sin(pB.y + time) + (pB.noise! - 0.5)) * 120 * easeP;
        const windZ = (Math.cos(pB.x + time) + (pB.noise! - 0.5)) * 120 * easeP;
        rx += windX; ry += windY; rz += windZ;
        if (pB.hidden) scale = 0;
        else scale = 1.07 * (1.0 - easeP * 0.4);
        rotX += easeP * time * 2; rotY += easeP * time * 2; rotZ += easeP * time * 2;
        
        baseFinalX = rx * 1.05 + alienOffsetX;
        baseFinalY = ry * 1.05 + ((s - 1.0) * vhIn3D); // Entra desde abajo y se centra en s=1.0
      }
      
      let finalX = baseFinalX;
      let finalY = baseFinalY;
      let finalZ = rz * 1.05;`;

if (content.includes('let finalX = rx * 1.05 + 18;')) {
    content = content.replace(oldUseFrame, newUseFrame);
}

// Fix totalProgress computation
content = content.replace(
    'const totalProgress = Math.min(1, Math.max(0, s / 0.8));',
    'const totalProgress = Math.min(1, Math.max(0, s)); // El morphing se completa exactamente a 100vh de scroll'
);

fs.writeFileSync('app/components/ParticleCanvas.tsx', content, 'utf-8');

// 2. Update home-client.tsx
let homeContent = fs.readFileSync('app/home-client.tsx', 'utf-8');

// Ocultar la imagen estática porque el Canvas la reemplazará
const oldImg = `<img
                  alt="Alien and astronaut sitting together showing peace signs"
                  className="w-full max-w-md mx-auto h-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                  src="/images/alien-astronaut.png"
                />`;
const newImg = `<img
                  alt="Alien and astronaut sitting together showing peace signs"
                  className="w-full max-w-md mx-auto h-auto object-contain opacity-0"
                  src="/images/alien-astronaut.png"
                />`;

if (homeContent.includes('drop-shadow-2xl hover:scale-105')) {
    homeContent = homeContent.replace(oldImg, newImg);
    fs.writeFileSync('app/home-client.tsx', homeContent, 'utf-8');
}

console.log('Update applied');
