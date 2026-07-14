import { MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const CAMERA_ORBIT_STEP_DEGREES = 45 as const;

const MINIMUM_POLAR_ANGLE = MathUtils.degToRad(5);
const MAXIMUM_POLAR_ANGLE = MathUtils.degToRad(175);

export interface CameraOrbitPose {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly distance: number;
}

export interface CameraOrbitCommands {
  readonly stepDegrees: typeof CAMERA_ORBIT_STEP_DEGREES;
  orbitLeft45(): CameraOrbitPose;
  orbitRight45(): CameraOrbitPose;
  orbitUp45(): CameraOrbitPose;
  orbitDown45(): CameraOrbitPose;
  reset(): CameraOrbitPose;
  getPose(): CameraOrbitPose;
}

export interface OrbitCameraController extends CameraOrbitCommands {
  dispose(): void;
}

declare global {
  interface Window {
    __BISMUTH_CAMERA__?: CameraOrbitCommands;
  }
}

function tuple(vector: Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

function cameraPose(
  camera: PerspectiveCamera,
  target: Vector3,
): CameraOrbitPose {
  const spherical = new Spherical().setFromVector3(
    camera.position.clone().sub(target),
  );
  return {
    position: tuple(camera.position),
    target: tuple(target),
    azimuthDegrees: MathUtils.radToDeg(spherical.theta),
    elevationDegrees: 90 - MathUtils.radToDeg(spherical.phi),
    distance: spherical.radius,
  };
}

export function rotateOrbitPosition(
  position: Vector3,
  target: Vector3,
  azimuthDegrees: number,
  elevationDegrees: number,
): Vector3 {
  if (!Number.isFinite(azimuthDegrees) || !Number.isFinite(elevationDegrees)) {
    throw new RangeError('Camera orbit increments must be finite.');
  }
  const spherical = new Spherical().setFromVector3(
    position.clone().sub(target),
  );
  spherical.theta += MathUtils.degToRad(azimuthDegrees);
  spherical.phi = MathUtils.clamp(
    spherical.phi - MathUtils.degToRad(elevationDegrees),
    MINIMUM_POLAR_ANGLE,
    MAXIMUM_POLAR_ANGLE,
  );
  return position.copy(target).add(new Vector3().setFromSpherical(spherical));
}

export function createOrbitCameraController(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  target: Vector3,
  render: () => void,
): OrbitCameraController {
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.minDistance = camera.position.distanceTo(target) * 0.35;
  controls.maxDistance = camera.position.distanceTo(target) * 3;
  controls.minPolarAngle = MINIMUM_POLAR_ANGLE;
  controls.maxPolarAngle = MAXIMUM_POLAR_ANGLE;
  controls.update();
  controls.saveState();

  const initialCursor = canvas.style.cursor;
  const renderOnChange = () => render();
  const showGrabCursor = () => {
    canvas.style.cursor = 'grab';
  };
  const showGrabbingCursor = () => {
    canvas.style.cursor = 'grabbing';
  };
  showGrabCursor();
  controls.addEventListener('change', renderOnChange);
  controls.addEventListener('start', showGrabbingCursor);
  controls.addEventListener('end', showGrabCursor);

  let disposed = false;
  const assertActive = () => {
    if (disposed) throw new Error('Camera orbit controller is disposed.');
  };
  const rotate = (
    azimuthDegrees: number,
    elevationDegrees: number,
  ): CameraOrbitPose => {
    assertActive();
    rotateOrbitPosition(
      camera.position,
      controls.target,
      azimuthDegrees,
      elevationDegrees,
    );
    camera.lookAt(controls.target);
    controls.update();
    render();
    return cameraPose(camera, controls.target);
  };

  const commands: OrbitCameraController = {
    stepDegrees: CAMERA_ORBIT_STEP_DEGREES,
    orbitLeft45: () => rotate(-CAMERA_ORBIT_STEP_DEGREES, 0),
    orbitRight45: () => rotate(CAMERA_ORBIT_STEP_DEGREES, 0),
    orbitUp45: () => rotate(0, CAMERA_ORBIT_STEP_DEGREES),
    orbitDown45: () => rotate(0, -CAMERA_ORBIT_STEP_DEGREES),
    reset() {
      assertActive();
      controls.reset();
      render();
      return cameraPose(camera, controls.target);
    },
    getPose() {
      assertActive();
      return cameraPose(camera, controls.target);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controls.removeEventListener('change', renderOnChange);
      controls.removeEventListener('start', showGrabbingCursor);
      controls.removeEventListener('end', showGrabCursor);
      controls.dispose();
      canvas.style.cursor = initialCursor;
      if (window.__BISMUTH_CAMERA__ === commands) {
        delete window.__BISMUTH_CAMERA__;
      }
    },
  };
  window.__BISMUTH_CAMERA__ = commands;
  return commands;
}
