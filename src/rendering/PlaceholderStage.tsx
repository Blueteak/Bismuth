import { ContactShadows, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { Color, MeshPhysicalMaterial } from 'three';
import { useAppStore } from '../state/appStore';

const oxideStops = ['#4fc3ff', '#8f7bff', '#ef62c8', '#f3b44b', '#68df91'];

export function PlaceholderStage() {
  const groupRef = useRef<Group>(null);
  const isTurntableEnabled = useAppStore((state) => state.isTurntableEnabled);
  const settings = useAppStore((state) => state.settings);

  const bismuthMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: new Color('#d3d5da'),
        metalness: 1,
        roughness: settings.surfaceRoughness,
        clearcoat: 0.25,
        clearcoatRoughness: 0.18,
        iridescence: settings.oxideIntensity,
        iridescenceIOR: 1.8,
        iridescenceThicknessRange: [
          120,
          120 + settings.iridescenceThicknessRange * 720,
        ],
      }),
    [
      settings.iridescenceThicknessRange,
      settings.oxideIntensity,
      settings.surfaceRoughness,
    ],
  );

  useFrame((_, delta) => {
    if (groupRef.current && isTurntableEnabled) {
      groupRef.current.rotation.y += delta * 0.32;
    }
  });

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[2.45, 128]} />
        <meshStandardMaterial color="#171b1d" roughness={0.82} metalness={0.2} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[1.48, 1.62, 0.18, 128]} />
        <meshStandardMaterial color="#23282b" roughness={0.5} metalness={0.55} />
      </mesh>

      <group ref={groupRef} position={[0, 0.32, 0]}>
        <mesh castShadow receiveShadow material={bismuthMaterial} position={[0, 0.55, 0]}>
          <boxGeometry args={[1.08, 1.08, 1.08]} />
        </mesh>

        <RoundedBox
          castShadow
          receiveShadow
          args={[1.42, 0.22, 1.42]}
          radius={0.025}
          smoothness={2}
          position={[0, 1.22, 0]}
          material={bismuthMaterial}
        />
        <RoundedBox
          castShadow
          receiveShadow
          args={[1.0, 0.22, 1.0]}
          radius={0.025}
          smoothness={2}
          position={[0, 1.52, 0]}
          material={bismuthMaterial}
        />
        <RoundedBox
          castShadow
          receiveShadow
          args={[0.58, 0.22, 0.58]}
          radius={0.025}
          smoothness={2}
          position={[0, 1.82, 0]}
          material={bismuthMaterial}
        />

        {oxideStops.map((color, index) => {
          const angle = (index / oxideStops.length) * Math.PI * 2;
          const radius = 0.86 + index * 0.06;

          return (
            <mesh
              castShadow
              key={color}
              position={[
                Math.cos(angle) * radius,
                0.74 + index * 0.11,
                Math.sin(angle) * radius,
              ]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[0.34, 0.08, 0.34]} />
              <meshPhysicalMaterial
                color={color}
                metalness={0.9}
                roughness={0.34}
                iridescence={settings.oxideIntensity}
                iridescenceThicknessRange={[160, 720]}
              />
            </mesh>
          );
        })}
      </group>

      <ContactShadows
        opacity={0.44}
        scale={6}
        blur={2.4}
        far={3}
        resolution={512}
        position={[0, 0.02, 0]}
      />
    </group>
  );
}
