import { MathUtils, Spherical, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_ORBIT_STEP_DEGREES,
  rotateOrbitPosition,
} from './orbit-camera-controller';

function spherical(position: Vector3, target: Vector3): Spherical {
  return new Spherical().setFromVector3(position.clone().sub(target));
}

describe('programmatic camera orbit increments', () => {
  it('rotates horizontally by exactly 45 degrees without changing distance', () => {
    const target = new Vector3(0, -0.35, 0);
    const position = new Vector3(6.2, 4.8, 6.4);
    const before = spherical(position, target);

    rotateOrbitPosition(position, target, CAMERA_ORBIT_STEP_DEGREES, 0);

    const after = spherical(position, target);
    expect(after.radius).toBeCloseTo(before.radius, 12);
    expect(MathUtils.radToDeg(after.theta - before.theta)).toBeCloseTo(45, 12);
    expect(after.phi).toBeCloseTo(before.phi, 12);
  });

  it('rotates vertically by exactly 45 degrees without changing distance', () => {
    const target = new Vector3(0, -0.35, 0);
    const position = new Vector3(6.2, 4.8, 6.4);
    const before = spherical(position, target);

    rotateOrbitPosition(position, target, 0, CAMERA_ORBIT_STEP_DEGREES);

    const after = spherical(position, target);
    expect(after.radius).toBeCloseTo(before.radius, 12);
    expect(after.theta).toBeCloseTo(before.theta, 12);
    expect(MathUtils.radToDeg(before.phi - after.phi)).toBeCloseTo(45, 12);
  });
});
