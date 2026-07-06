import { ContactShadows } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { Group, InstancedMesh } from 'three';
import { Color, DynamicDrawUsage, MeshPhysicalMaterial, Object3D } from 'three';
import type { CrystalBlock } from '../generation/types';
import { useAppStore } from '../state/appStore';
import { createSurfaceDetailTexture } from './surfaceDetailTexture';

const latticeScale = 0.057;
const tempObject = new Object3D();
const tempColor = new Color();

export function CrystalStage() {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<InstancedMesh>(null);
  const isTurntableEnabled = useAppStore((state) => state.isTurntableEnabled);
  const settings = useAppStore((state) => state.settings);
  const previewBlocks = useAppStore((state) => state.previewBlocks);
  const model = useAppStore((state) => state.crystalModel);
  const blocks = model?.blocks ?? previewBlocks;
  const detailTexture = useMemo(
    () => createSurfaceDetailTexture(settings.scratchDetailStrength),
    [settings.scratchDetailStrength],
  );

  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#d3d5da',
        metalness: 1,
        roughness: settings.surfaceRoughness,
        clearcoat: 0.22,
        clearcoatRoughness: 0.16 + settings.scratchDetailStrength * 0.2,
        iridescence: settings.oxideIntensity,
        iridescenceIOR: 1.8,
        iridescenceThicknessRange: [
          120,
          120 + settings.iridescenceThicknessRange * 720,
        ],
        bumpMap: detailTexture,
        bumpScale: settings.scratchDetailStrength * 0.028,
        vertexColors: true,
      }),
    [
      detailTexture,
      settings.iridescenceThicknessRange,
      settings.oxideIntensity,
      settings.scratchDetailStrength,
      settings.surfaceRoughness,
    ],
  );

  useEffect(() => () => detailTexture?.dispose(), [detailTexture]);
  useEffect(() => () => material.dispose(), [material]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    const center = getBlockCenter(blocks);
    const oxideRange = model?.oxideRange ?? getBlockOxideRange(blocks);

    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      const size = latticeScale * (0.82 + block.size);
      tempObject.position.set(
        (block.x - center[0]) * latticeScale,
        block.y * latticeScale + 0.26,
        (block.z - center[2]) * latticeScale,
      );
      tempObject.scale.set(size, size, size);
      tempObject.updateMatrix();
      mesh.setMatrixAt(index, tempObject.matrix);
      mesh.setColorAt(index, getOxideColor(block, oxideRange, settings.oxideIntensity));
    }

    mesh.count = blocks.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [blocks, model?.oxideRange, settings.oxideIntensity]);

  useFrame((_, delta) => {
    if (groupRef.current && isTurntableEnabled) {
      groupRef.current.rotation.y += delta * 0.32;
    }
  });

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[2.65, 128]} />
        <meshStandardMaterial color="#171b1d" roughness={0.82} metalness={0.2} />
      </mesh>

      <mesh castShadow receiveShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[1.48, 1.62, 0.18, 128]} />
        <meshStandardMaterial color="#23282b" roughness={0.5} metalness={0.55} />
      </mesh>

      <group ref={groupRef} position={[0, 0.18, 0]} scale={0.78}>
        {blocks.length > 0 ? (
          <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, blocks.length]}
            castShadow
            receiveShadow
            material={material}
          >
            <boxGeometry args={[1, 1, 1]} />
          </instancedMesh>
        ) : (
          <mesh castShadow receiveShadow material={material} position={[0, 0.55, 0]}>
            <boxGeometry args={[0.78, 0.78, 0.78]} />
          </mesh>
        )}
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

function getBlockCenter(blocks: CrystalBlock[]) {
  if (blocks.length === 0) {
    return [0, 0, 0] as const;
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const block of blocks) {
    minX = Math.min(minX, block.x);
    maxX = Math.max(maxX, block.x);
    minZ = Math.min(minZ, block.z);
    maxZ = Math.max(maxZ, block.z);
  }

  return [(minX + maxX) / 2, 0, (minZ + maxZ) / 2] as const;
}

function getBlockOxideRange(blocks: CrystalBlock[]) {
  if (blocks.length === 0) {
    return [0, 1] as [number, number];
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const block of blocks) {
    min = Math.min(min, block.oxideThickness);
    max = Math.max(max, block.oxideThickness);
  }

  return [min, max] as [number, number];
}

function getOxideColor(
  block: CrystalBlock,
  oxideRange: [number, number],
  oxideIntensity: number,
) {
  const span = Math.max(1, oxideRange[1] - oxideRange[0]);
  const normalized = (block.oxideThickness - oxideRange[0]) / span;
  const stageShift =
    block.stage === 'edge' ? 0.08 : block.stage === 'branch' ? 0.18 : block.stage === 'face' ? -0.05 : 0;
  const hue = (0.54 + normalized * 0.58 + stageShift) % 1;
  const saturation = 0.24 + oxideIntensity * 0.55;
  const lightness = 0.46 + normalized * 0.18;

  return tempColor.setHSL(hue, saturation, lightness);
}
