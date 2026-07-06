import {
  Environment,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
} from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { CrystalStage } from './CrystalStage';
import { useAppStore } from '../state/appStore';

export function GeneratorViewport() {
  const environmentIntensity = useAppStore(
    (state) => state.settings.environmentIntensity,
  );

  return (
    <div className="viewport" aria-label="Bismuth 3D viewport">
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
        shadows
      >
        <PerspectiveCamera makeDefault position={[5.4, 3.8, 6.2]} fov={43} />
        <color attach="background" args={['#0f1215']} />
        <fog attach="fog" args={['#0f1215', 10, 22]} />

        <ambientLight intensity={0.22} />
        <directionalLight
          castShadow
          color="#fff2d0"
          intensity={2.1}
          position={[4, 7, 3]}
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight color="#75e0ff" intensity={0.9} position={[-4, 2.2, -3]} />

        <CrystalStage />
        <Environment environmentIntensity={environmentIntensity} resolution={256}>
          <Lightformer
            color="#f5feff"
            intensity={2.8}
            position={[0, 4, -3]}
            rotation={[Math.PI / 3, 0, 0]}
            scale={[4, 2, 1]}
          />
          <Lightformer
            color="#ffc78f"
            intensity={1.6}
            position={[3, 2, 2]}
            rotation={[0, Math.PI / 4, 0]}
            scale={[2, 3, 1]}
          />
          <Lightformer
            color="#82e8ff"
            intensity={1.8}
            position={[-4, 1, 1]}
            rotation={[0, -Math.PI / 3, 0]}
            scale={[1.5, 3, 1]}
          />
        </Environment>
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={3.8}
          maxDistance={11}
          target={[0, 0.75, 0]}
        />
      </Canvas>
    </div>
  );
}
