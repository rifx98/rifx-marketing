const fs = require('fs');

const content = fs.readFileSync('app/components/ParticleCanvas.tsx', 'utf-8');

const badMarker = "lastProgress.current = p;seEffect, useState, Suspense } from 'react';";
const startIdx = content.indexOf(badMarker);

if (startIdx !== -1) {
  const before = content.substring(0, startIdx);
  const fixed = before + `lastProgress.current = p;
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
        <planeGeometry args={[0.35, 0.35]} />
        <meshBasicMaterial transparent opacity={0.8} fog={true} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    );
  }
  
  export default function ParticleCanvas() {
    return (
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ background: '#020510' }}>
        <Canvas camera={{ fov: 60, position: [0, 0, 45] }}>
          <fog attach="fog" args={['#020510', 50, 75]} />
          <Suspense fallback={null}>
            <ParticleSystem />
          </Suspense>
        </Canvas>
      </div>
    );
  }
`;
  fs.writeFileSync('app/components/ParticleCanvas.tsx', fixed, 'utf-8');
  console.log("Successfully repaired ParticleCanvas.tsx");
} else {
  console.log("Could not find the mangled string");
}
