const fs = require('fs');

let content = fs.readFileSync('app/components/ParticleCanvas.tsx', 'utf-8');

// 1. Add lastProgress ref
if (!content.includes('const lastProgress = useRef(-1);')) {
  content = content.replace(
    'const colorPhase = useRef(0);',
    'const colorPhase = useRef(0);\n  const lastProgress = useRef(-1);'
  );
}

// 2. Replace the math logic in useFrame
const oldLoopStart = 'const totalProgress = Math.min(1, Math.max(0, s)); // El morphing se completa exactamente a 100vh de scroll';
const oldLoopEnd = 'mesh.current.setMatrixAt(i, dummy.matrix);\n      }';

const startIdx = content.indexOf(oldLoopStart);
const endIdx = content.indexOf(oldLoopEnd) + oldLoopEnd.length;

if (startIdx !== -1 && endIdx !== -1) {
  const before = content.substring(0, startIdx);
  const after = content.substring(endIdx);
  
  const newLoop = `const totalProgress = Math.min(1, Math.max(0, s)); 
      
      const p = totalProgress;
      const isTransitioning = p > 0 && p < 1;
      const justFinished = (p === 0 || p === 1) && lastProgress.current !== p;
      const shouldUpdateColors = isTransitioning || justFinished;
      
      if (shouldUpdateColors && mesh.current.instanceColor) {
        colorPhase.current = p < 0.5 ? 0 : 1; // Para efectos estáticos que dependan de phase
      }

      const colors = mesh.current.instanceColor ? mesh.current.instanceColor.array : null;

      for (let i = 0; i < count; i++) {
        const pA = sourceShape.current[i];
        const pB = targetShape.current[i];
        if (!pA || !pB) {
          dummy.position.set(0,0,0);
          dummy.scale.set(0,0,0);
          dummy.updateMatrix();
          mesh.current.setMatrixAt(i, dummy.matrix);
          continue;
        }
        
        let rx, ry, rz;
        let rotX = 0, rotY = 0, rotZ = 0;
        let scale = 1.07;
        
        const vhIn3D = 54; 
        const isMobile = windowWidth.current < 1024;
        const logoOffsetX = isMobile ? 0 : 18;
        const alienOffsetX = isMobile ? 0 : -18;
        
        // -------------------------------------------------------------
        // SMOOTH ORGANIC WATERFALL TRANSITION
        // -------------------------------------------------------------
        
        // 1. Calculate individual particle delay based on Y coordinate so top falls first
        // pA.y goes roughly from -16 to +16. We normalize this to 0-1.
        const yNorm = Math.min(1, Math.max(0, (16 - pA.y) / 32)); 
        // Delay ranges from 0 (top) to 0.4 (bottom). 
        const delay = yNorm * 0.4;
        
        // Calculate local progress for this specific particle (from 0 to 1) over the remaining 0.6 duration
        const localP = Math.min(1, Math.max(0, (p - delay) / 0.6));
        
        // 2. Smooth easing curve (Cubic Ease In Out)
        const easeP = localP < 0.5 ? 4 * localP * localP * localP : 1 - Math.pow(-2 * localP + 2, 3) / 2;

        // 3. Interpolate basic position directly from Shape A to Shape B
        rx = pA.x + (pB.x - pA.x) * easeP;
        ry = pA.y + (pB.y - pA.y) * easeP;
        rz = pA.z + (pB.z - pA.z) * easeP;

        // 4. Add elegant swoop and wave during the transition
        // swoopY pulls them down in a parabola during the journey
        const swoopY = Math.sin(easeP * Math.PI) * -8.0; 
        ry += swoopY;
        
        // Slight horizontal wavy organic flow
        rx += Math.sin(easeP * Math.PI + pA.y * 0.2) * 2.0;
        rz += Math.sin(easeP * Math.PI + pA.x * 0.2) * 3.0;

        // 5. Interpolate horizontal screen offset
        const offsetX = logoOffsetX + (alienOffsetX - logoOffsetX) * easeP;
        
        let baseFinalX = rx * 1.05 + offsetX;
        let baseFinalY = ry * 1.05;
        
        let finalX = baseFinalX;
        let finalY = baseFinalY;
        let finalZ = rz * 1.05;
  
        let startX = particle.x * 2.5;
        let startY = particle.y * 2.5;
        let startZ = particle.z * 2.5;
        finalX = startX + (finalX - startX) * easeIntro;
        finalY = startY + (finalY - startY) * easeIntro;
        finalZ = startZ + (finalZ - startZ) * easeIntro;
  
        if (pA.hidden && pB.hidden) scale = 0;
        else if (pA.hidden) scale = 1.07 * easeP;
        else if (pB.hidden) scale = 1.07 * (1.0 - easeP);
        
        // Mouse hover interaction
        if (isMouseActive) {
          const dx = finalX - localMouseX;
          const dy = finalY - localMouseY;
          const distSq = dx*dx + dy*dy;
          const rSq = 64; 
          if (distSq < rSq) {
            const force = (1.0 - distSq/rSq) * 12.0;
            const dirX = dx / Math.sqrt(distSq);
            const dirY = dy / Math.sqrt(distSq);
            finalX += dirX * force;
            finalY += dirY * force;
            finalZ += force * 0.5;
          }
        }
  
        dummy.position.set(finalX, finalY, finalZ);
        dummy.rotation.set(rotX, rotY, rotZ);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.current.setMatrixAt(i, dummy.matrix);
        
        // Smooth Color Crossfade
        if (shouldUpdateColors && colors) {
           const cr = pA.r + (pB.r - pA.r) * easeP;
           const cg = pA.g + (pB.g - pA.g) * easeP;
           const cb = pA.b + (pB.b - pA.b) * easeP;
           colors[i*3] = cr;
           colors[i*3+1] = cg;
           colors[i*3+2] = cb;
        }
      }
      
      if (shouldUpdateColors && mesh.current.instanceColor) {
         mesh.current.instanceColor.needsUpdate = true;
      }
      lastProgress.current = p;`;

  content = before + newLoop + after;
  fs.writeFileSync('app/components/ParticleCanvas.tsx', content, 'utf-8');
  console.log('Successfully applied organic flow');
} else {
  console.log('Failed to find boundaries');
}
