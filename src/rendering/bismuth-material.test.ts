import { StorageBufferAttribute } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import {
  BISMUTH_IRIDESCENCE_STRENGTH,
  BISMUTH_OXIDE_IOR,
  BISMUTH_ROUGHNESS,
  createBismuthPhysicalNodeMaterial,
} from './bismuth-material';

describe('createBismuthPhysicalNodeMaterial', () => {
  it('binds promoted positions, normals, and surface age into physical nodes', () => {
    const positions = new StorageBufferAttribute(3, 4);
    const normalAge = new StorageBufferAttribute(3, 4);
    const material = createBismuthPhysicalNodeMaterial({
      positions,
      normalAge,
      vertexCapacity: 3,
    });

    expect(material.isMeshPhysicalNodeMaterial).toBe(true);
    expect(material.positionNode).not.toBeNull();
    expect(material.normalNode).not.toBeNull();
    expect(material.iridescenceNode).not.toBeNull();
    expect(material.iridescenceThicknessNode).not.toBeNull();
    expect(material.iridescence).toBe(BISMUTH_IRIDESCENCE_STRENGTH);
    expect(material.iridescenceIOR).toBe(BISMUTH_OXIDE_IOR);
    expect(material.metalness).toBeGreaterThan(0.9);
    expect(material.roughness).toBe(BISMUTH_ROUGHNESS);
    material.dispose();
  });

  it('rejects an invalid vertex capacity', () => {
    const positions = new StorageBufferAttribute(3, 4);
    const normalAge = new StorageBufferAttribute(3, 4);

    expect(() =>
      createBismuthPhysicalNodeMaterial({
        positions,
        normalAge,
        vertexCapacity: 0,
      }),
    ).toThrow(RangeError);
  });

  it('accepts only bounded developer thickness overrides', () => {
    const positions = new StorageBufferAttribute(3, 4);
    const normalAge = new StorageBufferAttribute(3, 4);
    const material = createBismuthPhysicalNodeMaterial({
      positions,
      normalAge,
      vertexCapacity: 3,
      oxideThicknessOverrideNanometers: 120,
    });

    expect(material.iridescenceThicknessNode).not.toBeNull();
    material.dispose();
    expect(() =>
      createBismuthPhysicalNodeMaterial({
        positions,
        normalAge,
        vertexCapacity: 3,
        oxideThicknessOverrideNanometers: 700,
      }),
    ).toThrow(RangeError);
  });
});
