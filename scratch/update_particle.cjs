const fs = require('fs');
let content = fs.readFileSync('app/components/ParticleCanvas.tsx', 'utf-8');

// Update LogoPoint interface
content = content.replace(
    'color: string;',
    'r: number; g: number; b: number;'
);

// Update signature
content = content.replace(
    'function getImagePoints(src: string, count: number): Promise<LogoPoint[]> {',
    'function getImagePoints(src: string, count: number, ignoreBg: boolean = false): Promise<LogoPoint[]> {'
);

// Update pixel loop
const oldPixelLoop = `          if (imgData[i + 3] > 60) { 
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            
            const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
            
            pixels.push({ 
              x: (x - size / 2) / divider, 
              y: -(y - size / 2) / divider, 
              color: hex 
            });
          }`;

const newPixelLoop = `          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          
          let skip = imgData[i + 3] <= 60;
          if (ignoreBg && r < 10 && g < 15 && b < 25) skip = true;
          
          if (!skip) { 
            pixels.push({ 
              x: (x - size / 2) / divider, 
              y: -(y - size / 2) / divider, 
              r: r / 255, g: g / 255, b: b / 255 
            });
          }`;
content = content.replace(oldPixelLoop, newPixelLoop);

content = content.replace(
    `color: p.color,`,
    `r: p.r, g: p.g, b: p.b,`
);

content = content.replace(
    `color: '#000000',`,
    `r: 0, g: 0, b: 0,`
);

content = content.replace(
    `  const logoShape = useRef<LogoPoint[]>(null);
  const scrollY = useRef(0);
  const introProgress = useRef(0);`,
    `  const sourceShape = useRef<LogoPoint[]>(null);
  const targetShape = useRef<LogoPoint[]>(null);
  const colorPhase = useRef(-1);
  const scrollY = useRef(0);
  const introProgress = useRef(0);`
);

const oldEffect = `    if (!mesh.current) return;

      // Cargar el Logo desde el PNG rasterizado del SVG para asegurar compatibilidad total del Canvas
      getImagePoints('/images/rifx-logo-particles-clean.png?v=5', count).then(points => {
      logoShape.current = points;
      
      // Aplicar colores exactos del logo
      for (let i = 0; i < count; i++) {
        color.set(points[i]?.color || '#ffffff');
        mesh.current!.setColorAt(i, color);
      }
      if (mesh.current!.instanceColor) {
        mesh.current!.instanceColor.needsUpdate = true;
      }
      setLogoLoaded(true);
    });`;

const newEffect = `    if (!mesh.current) return;

    Promise.all([
      getImagePoints('/images/rifx-logo-particles-clean.png?v=5', count, false),
      getImagePoints('/images/alien-astronaut.png', count, true)
    ]).then(([pointsA, pointsB]) => {
      sourceShape.current = pointsA;
      targetShape.current = pointsB;
      
      colorPhase.current = 0;
      for (let i = 0; i < count; i++) {
        color.setRGB(pointsA[i].r, pointsA[i].g, pointsA[i].b);
        mesh.current!.setColorAt(i, color);
      }
      if (mesh.current!.instanceColor) {
        mesh.current!.instanceColor.needsUpdate = true;
      }
      setLogoLoaded(true);
    });`;
content = content.replace(oldEffect, newEffect);

const oldUseFrame = `    const s = scrollY.current; 
    const globalTime = state.clock.elapsedTime;
    
    const isMouseActive = easeIntro > 0.9 && s < 0.2;
    // La posición finalX ya tiene el +18, así que comparamos directamente con mouse3D.x
    const localMouseX = mouse3D.x;
    const localMouseY = mouse3D.y;

    baseParticles.forEach((particle, i) => {
      particle.t += particle.speed;
      const time = particle.t;
      
      const pLogo = logoShape.current![i];
      
      if (!pLogo || pLogo.hidden) {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.current!.setMatrixAt(i, dummy.matrix);
        return;
      }
      
      // El 1.05 compensa la separación de las coordenadas (rx * 1.05) y el extra (0.02) sella las costuras oscuras
      let scale = 1.07;
      
      // Eliminada la matemática trigonométrica de rotación global (swingX/Y) dentro del loop para un ahorro brutal de CPU
      let rx = pLogo.x;
      let ry = pLogo.y;
      let rz = pLogo.z;
      
      let rotX = 0;
      let rotY = 0;
      let rotZ = 0;

      // Dispersión masiva desde el inicio del scroll
      const organicNoise = (pLogo.noise || 0);
      // El threshold empieza en 0 (inmediatamente al scrollear) con un poco de ruido para que no salgan todas al mismo tiempo
      const threshold = organicNoise * 0.05; 
      
      if (s > threshold) {
        // La animación de dispersión abarca casi toda la página (hasta el 80% del scroll)
        const progress = Math.min(1, (s - threshold) / 0.8);
        const easeP = progress * progress;
        
        // Viento expansivo controlado para que llenen la pantalla pero NO se salgan de cámara
        const windX = (pLogo.noise! - 0.5) * 90 * easeP;
        const windY = (Math.sin(pLogo.y + time) + (pLogo.noise! - 0.5)) * 60 * easeP;
        const windZ = (Math.cos(pLogo.x + time) + (pLogo.noise! - 0.5)) * 60 * easeP;
        
        rx += windX;
        ry += windY;
        rz += windZ;
        
        // No desaparecen! Se reducen un poco para parecer polvo estelar flotante, pero se mantienen visibles
        scale = 1.07 * (1.0 - easeP * 0.4);
        
        rotX += easeP * time * 2;
        rotY += easeP * time * 2;
        rotZ += easeP * time * 2;
      }
      
      // Centrado en el panel derecho con una escala perfecta para evitar que se corte en los bordes
      let finalX = rx * 1.05 + 18;
      let finalY = ry * 1.05;
      let finalZ = rz * 1.05;

      // Intro Animation: Empiezan dispersas (Random) y se ensamblan hacia finalX, Y, Z
      // Multiplicamos particle.x/y/z por un factor para que empiecen bien dispersas
      let startX = particle.x * 2.5;
      let startY = particle.y * 2.5;
      let startZ = particle.z * 2.5;
      
      finalX = startX + (finalX - startX) * easeIntro;
      finalY = startY + (finalY - startY) * easeIntro;
      finalZ = startZ + (finalZ - startZ) * easeIntro;
      
      // Interacción con el mouse (optimizada)
      if (isMouseActive) {
        const dx = finalX - localMouseX;
        const dy = finalY - localMouseY;
        const distSq = dx * dx + dy * dy;
        
        if (distSq < 60) { 
          // Efecto de distorsión más suave
          const intensity = Math.pow((60 - distSq) / 60, 1.5); 
          
          const angle = Math.atan2(dy, dx);
          // Fuerza de repelencia reducida a 2.0
          const repelStrength = intensity * 2.0; 
          
          finalX += Math.cos(angle) * repelStrength + (pLogo.noise! - 0.5) * repelStrength;
          finalY += Math.sin(angle) * repelStrength + (pLogo.noise! - 0.5) * repelStrength;
          finalZ += intensity * 2.0 + (pLogo.noise! - 0.5) * repelStrength;
          
          rotX += intensity * 0.2;
          rotY += intensity * 0.2;
        }
      }

      dummy.position.set(finalX, finalY, finalZ);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.order = 'YXZ';
      dummy.rotation.set(rotX, rotY, rotZ);
      dummy.updateMatrix();
      
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });`;

const newUseFrame = `    const s = scrollY.current; 
    const globalTime = state.clock.elapsedTime;
    
    const isMouseActive = easeIntro > 0.9 && s < 0.2;
    const localMouseX = mouse3D.x;
    const localMouseY = mouse3D.y;

    const totalProgress = Math.min(1, Math.max(0, s / 0.8));
    const phase = totalProgress < 0.5 ? 0 : 1;
    
    if (phase !== colorPhase.current && mesh.current.instanceColor) {
       colorPhase.current = phase;
       const colors = mesh.current.instanceColor.array;
       const shape = phase === 0 ? sourceShape.current : targetShape.current;
       for (let i = 0; i < count; i++) {
          colors[i*3] = shape[i].r;
          colors[i*3+1] = shape[i].g;
          colors[i*3+2] = shape[i].b;
       }
       mesh.current.instanceColor.needsUpdate = true;
    }

    baseParticles.forEach((particle, i) => {
      particle.t += particle.speed;
      const time = particle.t;
      
      const pA = sourceShape.current![i];
      const pB = targetShape.current![i];
      
      if ((pA.hidden && pB.hidden) || !pA || !pB) {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.current!.setMatrixAt(i, dummy.matrix);
        return;
      }
      
      let rx, ry, rz;
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
      let finalZ = rz * 1.05;

      let startX = particle.x * 2.5;
      let startY = particle.y * 2.5;
      let startZ = particle.z * 2.5;
      finalX = startX + (finalX - startX) * easeIntro;
      finalY = startY + (finalY - startY) * easeIntro;
      finalZ = startZ + (finalZ - startZ) * easeIntro;
      
      if (isMouseActive) {
        const dx = finalX - localMouseX;
        const dy = finalY - localMouseY;
        const distSq = dx * dx + dy * dy;
        if (distSq < 60) { 
          const intensity = Math.pow((60 - distSq) / 60, 1.5); 
          const angle = Math.atan2(dy, dx);
          const repelStrength = intensity * 2.0; 
          finalX += Math.cos(angle) * repelStrength + (pLogo.noise! - 0.5) * repelStrength;
          finalY += Math.sin(angle) * repelStrength + (pLogo.noise! - 0.5) * repelStrength;
          finalZ += intensity * 2.0 + (pLogo.noise! - 0.5) * repelStrength;
          rotX += intensity * 0.2; rotY += intensity * 0.2;
        }
      }

      dummy.position.set(finalX, finalY, finalZ);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.order = 'YXZ';
      dummy.rotation.set(rotX, rotY, rotZ);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });`;

content = content.replace(oldUseFrame, newUseFrame);

content = content.replace('if (!mesh.current || !logoShape.current) return;', 'if (!mesh.current || !sourceShape.current || !targetShape.current) return;');

fs.writeFileSync('app/components/ParticleCanvas.tsx', content, 'utf-8');
console.log('Morphing update applied successfully.');
