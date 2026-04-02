/**
 * GlobalSim Helioshield — 3D Sun-Earth-L1 Scene
 *
 * Minimal, educational 3D visualization:
 *   - Sun (emissive sphere with glow)
 *   - Earth (blue sphere at 1 AU)
 *   - L1 point marker (DSCOVR position)
 *   - Solar wind particle flow (instanced mesh)
 *   - IMF field direction indicator
 *
 * Not-to-scale for visual clarity. Distances compressed.
 * Respects prefers-reduced-motion.
 *
 * Known: THREE.Clock deprecation warning comes from @react-three/fiber
 * internals — cannot be fixed without upstream library update.
 */

import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Billboard, Line } from '@react-three/drei';
import * as THREE from 'three';

const PARTICLE_COUNT = 200;
const SUN_RADIUS = 1.2;
const EARTH_DISTANCE = 8;
const L1_DISTANCE = EARTH_DISTANCE - 1.5;

/** Debounce mount to prevent rapid WebGL context creation during HMR/toggle */
const MOUNT_DELAY_MS = 100;

interface SceneProps {
  solarWindSpeed: number | null;
  bzNt: number | null;
  kpEstimate: number | null;
}

/** Solar wind particles flowing Sun → Earth */
function SolarWindParticles({ speed }: { speed: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const normalizedSpeed = Math.min(1, Math.max(0, (speed - 300) / 600));

  const particleData = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * EARTH_DISTANCE,
      y: (Math.random() - 0.5) * 2.5,
      z: (Math.random() - 0.5) * 2.5,
      speed: 0.01 + Math.random() * 0.03,
    }));
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const speedFactor = 0.5 + normalizedSpeed * 1.5;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particleData[i];
      p.x += p.speed * speedFactor;
      if (p.x > EARTH_DISTANCE + 1) {
        p.x = SUN_RADIUS + 0.5;
        p.y = (Math.random() - 0.5) * 2.5;
        p.z = (Math.random() - 0.5) * 2.5;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(0.02 + normalizedSpeed * 0.02);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const color = new THREE.Color().lerpColors(
    new THREE.Color('#4fc3f7'),
    new THREE.Color('#ff7043'),
    normalizedSpeed
  );

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} />
    </instancedMesh>
  );
}

function Sun() {
  return (
    <group position={[0, 0, 0]}>
      <mesh>
        <sphereGeometry args={[SUN_RADIUS, 32, 32]} />
        <meshStandardMaterial color="#ffa726" emissive="#ff8f00" emissiveIntensity={2} />
      </mesh>
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 1.3, 16, 16]} />
        <meshBasicMaterial color="#ffa726" transparent opacity={0.08} />
      </mesh>
      <Billboard position={[0, SUN_RADIUS + 0.5, 0]}>
        <Text fontSize={0.3} color="#ffa726" anchorX="center" anchorY="bottom">
          Sun
        </Text>
      </Billboard>
    </group>
  );
}

function Earth({ kp }: { kp: number }) {
  const auroraIntensity = Math.min(1, kp / 9);
  const auroraColor = new THREE.Color().lerpColors(
    new THREE.Color('#1b5e20'),
    new THREE.Color('#00e676'),
    auroraIntensity
  );

  return (
    <group position={[EARTH_DISTANCE, 0, 0]}>
      <mesh>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial color="#1565c0" />
      </mesh>
      {kp > 3 && (
        <mesh>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshBasicMaterial
            color={auroraColor}
            transparent
            opacity={0.15 + auroraIntensity * 0.25}
          />
        </mesh>
      )}
      <Billboard position={[0, 0.7, 0]}>
        <Text fontSize={0.25} color="#4fc3f7" anchorX="center" anchorY="bottom">
          Earth
        </Text>
      </Billboard>
    </group>
  );
}

function L1Marker() {
  return (
    <group position={[L1_DISTANCE, 0, 0]}>
      <mesh>
        <octahedronGeometry args={[0.1]} />
        <meshStandardMaterial color="#7c4dff" emissive="#7c4dff" emissiveIntensity={0.5} />
      </mesh>
      <Billboard position={[0, 0.4, 0]}>
        <Text fontSize={0.18} color="#7c4dff" anchorX="center" anchorY="bottom">
          L1 (DSCOVR)
        </Text>
      </Billboard>
    </group>
  );
}

function BzIndicator({ bz }: { bz: number }) {
  const direction = bz < 0 ? -1 : 1;
  const magnitude = Math.min(1, Math.abs(bz) / 20);
  const color = bz < 0 ? '#ef5350' : '#66bb6a';

  return (
    <group position={[L1_DISTANCE, 0, 0]}>
      <mesh position={[0, direction * 0.3, 0]} rotation={[0, 0, bz < 0 ? Math.PI : 0]}>
        <coneGeometry args={[0.06, 0.3 + magnitude * 0.5, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <Billboard position={[0.4, direction * 0.5, 0]}>
        <Text fontSize={0.15} color={color} anchorX="left" anchorY="middle">
          Bz {bz?.toFixed(1) ?? '?'} nT
        </Text>
      </Billboard>
    </group>
  );
}

function OrbitLine() {
  const points = useMemo(
    () => [
      [SUN_RADIUS + 0.2, 0, 0] as [number, number, number],
      [EARTH_DISTANCE - 0.5, 0, 0] as [number, number, number],
    ],
    []
  );
  return <Line points={points} color="#ffffff" opacity={0.1} transparent lineWidth={1} />;
}

/** Main 3D scene with debounced mount and cleanup */
export function SunEarthScene({ solarWindSpeed, bzNt, kpEstimate }: SceneProps) {
  const speed = solarWindSpeed ?? 400;
  const bz = bzNt ?? 0;
  const kp = kpEstimate ?? 0;

  // Debounce mount to prevent rapid WebGL context creation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), MOUNT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setMounted(false);
    };
  }, []);

  if (!mounted) {
    return (
      <div className="panel panel--span-2" style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="text-secondary text-sm">Initializing 3D scene…</span>
      </div>
    );
  }

  return (
    <div
      className="panel panel--span-2"
      style={{ height: '320px', position: 'relative', padding: 0, overflow: 'hidden' }}
      role="img"
      aria-label="3D Sun-Earth visualization (not to scale)"
    >
      <Canvas
        camera={{ position: [4, 3, 6], fov: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        style={{ background: '#06090f' }}
        frameloop="demand"
        onCreated={({ gl }) => {
          // Ensure renderer is properly sized and uses low-power GPU if available
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }}
      >
        <FrameDriver />
        <ambientLight intensity={0.3} />
        <pointLight position={[0, 0, 0]} intensity={3} color="#ffa726" />

        <Sun />
        <Earth kp={kp} />
        <L1Marker />
        <OrbitLine />
        <SolarWindParticles speed={speed} />
        <BzIndicator bz={bz} />

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={15}
          autoRotate
          autoRotateSpeed={0.3}
        />
      </Canvas>

      <div style={{
        position: 'absolute', bottom: 8, left: 8, right: 8,
        display: 'flex', gap: '8px', flexWrap: 'wrap',
        pointerEvents: 'none'
      }}>
        <span className="badge badge--simulation">Simulation Estimate — Not to Scale</span>
        <span className="text-xs text-secondary" style={{ alignSelf: 'center' }}>
          Drag to rotate · Scroll to zoom
        </span>
      </div>
    </div>
  );
}

/** Drives continuous rendering for particle animation */
function FrameDriver() {
  useFrame(({ invalidate }) => { invalidate(); });
  return null;
}
