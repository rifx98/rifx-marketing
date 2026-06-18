"use client";

import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Interface for particle coordinates
interface LogoPoint {
  x: number;
  y: number;
  z: number;
  r: number; g: number; b: number;
  xNorm: number;
  noise?: number;
  hidden?: boolean;
  isBg?: boolean;
}

// Generador por Muestreo de Imagen (Para leer el logo real y crear extrusión 3D nítida)
function getImagePoints(src: string, count: number, ignoreBg: boolean = false, rotationDeg: number = 0): Promise<LogoPoint[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Resolución 400x400 para buen detalle pero rendimiento 4x más rápido
      const size = 400;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return resolve([]);

      ctx.clearRect(0, 0, size, size);

      // Mantener proporciones
      const scaleImage = Math.min(size / img.width, size / img.height);
      const w = img.width * scaleImage;
      const h = img.height * scaleImage;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

      const imgData = ctx.getImageData(0, 0, size, size).data;
      const pixels = [];

      // Divider ajustado para la nueva resolución de 400
      const divider = 12.0;

      const angle = rotationDeg * Math.PI / 180.0;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Escaneo de píxeles activos (con alpha relevante)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;

          // Umbral de 60 para evitar que los píxeles semi-transparentes hagan que las letras finas se vean gordas/hinchadas.
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];

          let skip = imgData[i + 3] <= 100;
          if (ignoreBg && r < 15 && g < 20 && b < 30) skip = true;
          // Si el pixel es un gris casi imperceptible o un blanco casi transparente, ignorarlo para evitar el blob blanco
          if (ignoreBg && r > 240 && g > 240 && b > 240 && imgData[i + 3] < 150) skip = true;

          if (!skip) {
            // Restaurando la conversión de sRGB a Lineal, ahora que la niebla oscura fue removida
            const rNorm = r / 255;
            const gNorm = g / 255;
            const bNorm = b / 255;

            const rLin = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
            const gLin = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
            const bLin = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

            const rawX = (x - size / 2) / divider;
            const rawY = -(y - size / 2) / divider;

            // Aplicar matriz de rotación 2D para enderezar el logo
            const rotX = rawX * cosA - rawY * sinA;
            const rotY = rawX * sinA + rawY * cosA;

            pixels.push({
              x: rotX,
              y: rotY,
              r: rLin, g: gLin, b: bLin
            });
          }
        }
      }

      if (pixels.length === 0) {
        console.warn(`getImagePoints: No valid pixels found for ${src}`);
        return resolve([]);
      }

      // Muestreo uniforme: Si la imagen tiene demasiados píxeles, 
      // no cortamos el array (lo que causaba el "corte recto" de la imagen),
      // sino que tomamos una muestra uniforme de toda la imagen.
      const maxParticles = count;
      let finalPixels = pixels;
      if (pixels.length > maxParticles) {
        finalPixels = [];
        const step = pixels.length / maxParticles;
        for (let i = 0; i < maxParticles; i++) {
          finalPixels.push(pixels[Math.floor(i * step)]);
        }
      }

      // Calcular límites en X
      let minX = Infinity;
      let maxX = -Infinity;
      finalPixels.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
      });

      const rangeX = maxX - minX || 1;

      const coordinates: LogoPoint[] = [];

      for (let i = 0; i < count; i++) {
        if (i < finalPixels.length) {
          const p = finalPixels[i];
          const xNorm = (p.x - minX) / rangeX;

          coordinates.push({
            x: p.x,
            y: p.y,
            z: 0, // Quitamos el ruido aleatorio en Z para que el logo sea perfectamente plano y nítido
            r: p.r, g: p.g, b: p.b,
            xNorm: xNorm,
            noise: Math.random()
          });
        } else {
          coordinates.push({
            x: 0, y: 0, z: 0, r: 0, g: 0, b: 0, xNorm: 0, noise: 0, hidden: true
          });
        }
      }

      // Mezclamos el arreglo para que el morphing sea orgánico
      for (let i = coordinates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [coordinates[i], coordinates[j]] = [coordinates[j], coordinates[i]];
      }
      resolve(coordinates);
    };
    img.onerror = (err) => {
      console.error(`getImagePoints: Failed to load image ${src}`, err);
      resolve([]);
    };
  });
}

function Particles() {
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  const logoCount = isMobile ? 10000 : 35000; // Reducido drásticamente en móviles para rendimiento fluido
  const count = logoCount;

  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const sourceShape = useRef<LogoPoint[] | null>(null);
  const targetShape = useRef<LogoPoint[] | null>(null);
  const starShape = useRef<LogoPoint[] | null>(null);
  const lastScrollY = useRef(-1);
  const scrollY = useRef(0);
  const windowWidth = useRef(1024);
  const introProgress = useRef(0);
  const globalMouse = useRef({ x: -1000, y: -1000 }); // Inicializamos fuera de pantalla

  const [logoLoaded, setLogoLoaded] = useState(false);

  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!mesh.current) return;

    Promise.all([
      getImagePoints('/images/rifx-logo-user.png', count, true, 0), // Sin rotación para mantener la imagen original recta
      getImagePoints('/images/alien-astronaut.png', count, true, 0)
    ]).then(([pointsA, pointsB]) => {
      sourceShape.current = pointsA;
      targetShape.current = pointsB;

      if (!pointsA.length || !pointsB.length) {
        console.error("getImagePoints returned empty points, stopping particle generation.");
        return;
      }

      // Generate the Starfield (explosion target) and persistent background
      const pointsC: LogoPoint[] = [];
      const numStars = isMobile ? 3000 : 10000; // Reducido para mejor rendimiento en móviles
      for (let i = 0; i < count; i++) {
        if (i >= count - numStars || (pointsA[i].hidden && pointsB[i].hidden)) {
          // This particle is not used by the Logo or the Alien!
          // Convert it into a persistent background space particle for the whole page
          const z = -10 - Math.random() * 250; 
          const maxSpread = 150 + Math.abs(45 - z) * 4; 
          const x = (Math.random() - 0.5) * maxSpread;
          const y = (Math.random() - 0.5) * maxSpread;
          
          const rType = Math.random();
          let r, g, b;
          if (rType < 0.6) { r = 1; g = 1; b = 1; }
          else if (rType < 0.8) { r = 0.5; g = 0.8; b = 1.0; }
          else { r = 1.0; g = 0.8; b = 0.5; }

          const starNoise = Math.random();
          pointsA[i] = { x, y, z, r, g, b, xNorm: 0, hidden: false, isBg: true, noise: starNoise };
          pointsB[i] = { x, y, z, r, g, b, xNorm: 0, hidden: false, isBg: true, noise: starNoise };
          pointsC.push({ x, y, z, r, g, b, xNorm: 0, hidden: false, isBg: true, noise: starNoise });
        } else {
          // Normal active particle (will explode out of the screen later)
          const z = -350 + Math.random() * 394; 
          const maxSpread = 200 + Math.abs(45 - z) * 3.5; 
          const x = (Math.random() - 0.5) * maxSpread;
          const y = (Math.random() - 0.5) * maxSpread;

          const rType = Math.random();
          let r, g, b;
          if (rType < 0.6) { r = 1; g = 1; b = 1; }
          else if (rType < 0.8) { r = 0.5; g = 0.8; b = 1.0; }
          else { r = 1.0; g = 0.8; b = 0.5; }

          pointsC.push({
            x, y, z, r, g, b, xNorm: 0, hidden: false
          });
        }
      }
      starShape.current = pointsC;

      for (let i = 0; i < count; i++) {
        color.setRGB(pointsA[i].r, pointsA[i].g, pointsA[i].b);
        mesh.current!.setColorAt(i, color);
      }
      if (mesh.current!.instanceColor) {
        mesh.current!.instanceColor.needsUpdate = true;
      }
      setLogoLoaded(true);
    });

    const handleScroll = () => {
      scrollY.current = window.scrollY / window.innerHeight;
      windowWidth.current = window.innerWidth;
    };

    const handleMouseMove = (e: MouseEvent) => {
      globalMouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      globalMouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [count, color]);

  useFrame((state) => {
    if (!mesh.current || !sourceShape.current || !targetShape.current || !starShape.current) return;

    // Animate intro progress for the assemble effect
    introProgress.current = Math.min(1.0, introProgress.current + 0.012);
    const easeIntro = 1.0 - Math.pow(1.0 - introProgress.current, 4);

    const vector = new THREE.Vector3(globalMouse.current.x, globalMouse.current.y, 0.5);
    vector.unproject(state.camera);
    const dir = vector.sub(state.camera.position).normalize();
    const distance = -state.camera.position.z / dir.z;
    const mouse3D = state.camera.position.clone().add(dir.multiplyScalar(distance));

    const s = scrollY.current;

    // Phase 1: Logo -> Alien (from scroll 0 to 1)
    const t1 = Math.min(1, Math.max(0, s));
    // Phase 2: Alien -> Starfield Explosion (Disintegrates slowly from bottom to top over the ENTIRE Mission section, 1.0 to 1.8)
    const t2 = Math.min(1, Math.max(0, (s - 0.7) / 1.1));

    // Only update colors if scroll changed to save CPU
    const hasScrollChanged = Math.abs(s - lastScrollY.current) > 0.0001;
    const shouldUpdateColors = hasScrollChanged;

    const isMouseActive = easeIntro > 0.9 && s < 0.2;
    const localMouseX = mouse3D.x;
    const localMouseY = mouse3D.y;

    const colors = mesh.current.instanceColor ? mesh.current.instanceColor.array : null;

    for (let i = 0; i < count; i++) {
      const pA = sourceShape.current[i];
      const pB = targetShape.current[i];
      const pC = starShape.current[i];

      if (!pA || !pB || !pC) continue;

      if (pA.isBg) {
        // Persistent background particle (always stars, floating slowly)
        const time = state.clock.elapsedTime;
        const bgX = pA.x + Math.sin(time * 0.1 + pA.y * 0.05) * 8;
        const bgY = pA.y + Math.cos(time * 0.1 + pA.x * 0.05) * 8;
        const bgZ = pA.z + Math.sin(time * 0.1 + pA.z * 0.05) * 8;
        
        dummy.position.set(bgX, bgY, bgZ);
        dummy.rotation.set(0, 0, (pA.noise || 0) * Math.PI * 2 + time * 0.05);
        // Make them slightly smaller to look like distant stars
        dummy.scale.setScalar(0.5 + (pA.noise || 0) * 0.7); 
        dummy.updateMatrix();
        mesh.current.setMatrixAt(i, dummy.matrix);
        
        if (shouldUpdateColors && colors) {
          colors[i*3] = pA.r;
          colors[i*3+1] = pA.g;
          colors[i*3+2] = pA.b;
        }
        continue;
      }

      let rx, ry, rz;
      let rotX = 0, rotY = 0, rotZ = (pA.noise || 0) * Math.PI * 2;
      let scale = 1.07;

      const isMobile = windowWidth.current < 1024;
      const logoOffsetX = isMobile ? 0 : 18;
      const alienOffsetX = isMobile ? 0 : -18;
      
      // Phase 1 Interpolation (Logo -> Alien)
      const yNorm = Math.min(1, Math.max(0, (16 - pA.y) / 32));
      const delay = yNorm * 0.4;
      const localP = Math.min(1, Math.max(0, (t1 - delay) / 0.6));
      const easeP = localP < 0.5 ? 4 * localP * localP * localP : 1 - Math.pow(-2 * localP + 2, 3) / 2;

      // En móviles reducimos drásticamente el tamaño del logo para que se vea nítido y bien encuadrado.
      // También lo desplazamos hacia abajo para que no tape el texto de arriba.
      const mobileOffsetY = isMobile ? -22 : 0;
      const shapeScale = isMobile ? 0.52 : 1.05;

      // Phase 2 Interpolation (Alien -> Starfield Explosion)
      // We want it to disintegrate from BOTTOM to TOP.
      // pB.y goes from roughly -16 (bottom) to +16 (top).
      // So (pB.y + 16) / 32 gives 0 at the bottom and 1 at the top.
      const yNorm2 = Math.min(1, Math.max(0, (pB.y + 16) / 32));
      // Add a tiny bit of pseudo-randomness for an organic, sandy feel
      const pseudoRand = Math.abs((pC.x * pC.y) % 1.0);
      const delay2 = yNorm2 * 0.4 + pseudoRand * 0.1;

      const localP2 = Math.min(1, Math.max(0, (t2 - delay2) / 0.5));
      // Smooth Cubic Ease In Out for a progressive, connected-to-scroll dispersion
      const easeP2 = localP2 < 0.5 ? 4 * localP2 * localP2 * localP2 : 1 - Math.pow(-2 * localP2 + 2, 3) / 2;

      // 1. Base position from Logo to Alien
      rx = pA.x + (pB.x - pA.x) * easeP;
      ry = pA.y + (pB.y - pA.y) * easeP;
      rz = pA.z + (pB.z - pA.z) * easeP;

      // 2. Base position from Alien to Starfield
      if (t2 > 0) {
        rx = rx + (pC.x - rx) * easeP2;
        ry = ry + (pC.y - ry) * easeP2;
        rz = rz + (pC.z - rz) * easeP2;
      }

      // 3. Horizontal Offset
      // Offset goes to 0 during starfield so stars are centered everywhere
      const currentOffsetX = logoOffsetX + (alienOffsetX - logoOffsetX) * easeP;
      const finalOffsetX = currentOffsetX * (1 - easeP2);

      let baseFinalX = rx * shapeScale + finalOffsetX;
      let baseFinalY = ry * shapeScale + mobileOffsetY;

      let finalX = baseFinalX;
      let finalY = baseFinalY;
      let finalZ = rz * 1.05;

      // Add "life" to the stars when they are formed
      if (t2 > 0) {
        const time = state.clock.elapsedTime;
        // Organic floating movement using sine waves based on their unique coordinates
        // Multiplied by easeP2 so the movement smoothly ramps up as they explode
        finalX += Math.sin(time * 0.3 + pC.y * 0.1) * 15 * easeP2;
        finalY += Math.cos(time * 0.25 + pC.x * 0.1) * 15 * easeP2;
        finalZ += Math.sin(time * 0.4 + pC.z * 0.1) * 20 * easeP2;
      }

      let startX = pA.x * 2.5;
      let startY = pA.y * 2.5;
      let startZ = pA.z * 2.5;
      finalX = startX + (finalX - startX) * easeIntro;
      finalY = startY + (finalY - startY) * easeIntro;
      finalZ = startZ + (finalZ - startZ) * easeIntro;

      if (pA.hidden && pB.hidden) scale = 0;
      else if (pA.hidden) scale = 1.07 * easeP;
      else if (pB.hidden) scale = 1.07 * (1.0 - easeP);

      // If it's a star, we might want to scale them down slightly so they look like tiny stars
      if (t2 > 0) {
        scale = scale * (1 - easeP2 * 0.5); // Reduce size by 50% max when fully stars
      }

      if (isMouseActive && t2 === 0) {
        const dx = finalX - localMouseX;
        const dy = finalY - localMouseY;
        const distSq = dx * dx + dy * dy;
        const rSq = 9;
        if (distSq < rSq) {
          const force = (1.0 - distSq / rSq) * 2.0;
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

      if (shouldUpdateColors && colors) {
        let cr = pA.r + (pB.r - pA.r) * easeP;
        let cg = pA.g + (pB.g - pA.g) * easeP;
        let cb = pA.b + (pB.b - pA.b) * easeP;

        if (t2 > 0) {
          cr = cr + (pC.r - cr) * easeP2;
          cg = cg + (pC.g - cg) * easeP2;
          cb = cb + (pC.b - cb) * easeP2;
        }

        colors[i * 3] = cr;
        colors[i * 3 + 1] = cg;
        colors[i * 3 + 2] = cb;
      }
    }

    if (shouldUpdateColors && mesh.current.instanceColor) {
      mesh.current.instanceColor.needsUpdate = true;
    }
    lastScrollY.current = s;
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  useEffect(() => {
    const handleResize = () => {
      windowWidth.current = window.innerWidth;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <circleGeometry args={[0.09, 4]} />
      <meshBasicMaterial transparent opacity={1.0} fog={true} depthWrite={false} blending={THREE.NormalBlending} />
    </instancedMesh>
  );
}

export default function ParticleCanvas() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: 'transparent' }}>
      <Canvas camera={{ fov: 60, position: [0, 0, 45] }}>
        <fog attach="fog" args={['#020510', 50, 450]} />
        <Suspense fallback={null}>
          <Particles />
        </Suspense>
      </Canvas>
    </div>
  );
}
