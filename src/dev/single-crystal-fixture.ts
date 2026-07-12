import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
} from 'three/webgpu';
import {
  createSimulationConfiguration,
  deriveSimulationConfiguration,
  type DerivedSimulationConfiguration,
  type SimulationConfiguration,
  type SimulationPresetName,
} from '../simulation/config';
import {
  createGpuSingleCrystalSolver,
  SOLVER_WORKGROUP_SIZE,
  type GpuFieldState,
  type GpuSingleCrystalSolver,
  type SolverStepTimings,
} from '../simulation/gpu-solver';
import {
  evaluateExpectedMorphology,
  measureFaceCenterDepression,
  measureGrowthMaturity,
  measureSolidBounds,
  measureSymmetry,
  measureTransitionMorphology,
  summarizeField,
} from '../simulation/metrics';
import {
  createWebGpuSession,
  type WebGpuDiagnostics,
  type WebGpuSession,
} from '../rendering/webgpu-capability';
import {
  evaluateValidationProfile,
  isScreeningValidationProfile,
  type FixtureMode,
  type ValidationProfile,
  type ValidationProfileResult,
} from './morphology-validation-profile';
import './single-crystal.css';

export interface SingleCrystalFixtureResult {
  readonly mode: FixtureMode;
  readonly validationProfile: ValidationProfile | null;
  readonly expectedMorphology: SimulationPresetName;
  readonly diagnostics: WebGpuDiagnostics;
  readonly configuration: {
    readonly grid: readonly [number, number, number];
    readonly workgroup: typeof SOLVER_WORKGROUP_SIZE;
    readonly precision: 'float32';
    readonly spacing: number;
    readonly timeStep: number;
    readonly steps: number;
    readonly simulatedTime: number;
    readonly phaseOperator: SimulationConfiguration['phaseOperator'];
    readonly domainMode: SimulationConfiguration['domainMode'];
    readonly liquidDiffusivity: number;
    readonly farFieldChemicalPotential: number;
    readonly criticalRadius: number;
    readonly initialRadius: number;
    readonly interfaceWidth: number;
    readonly surfaceEnergyNormalization: number;
    readonly perturbations: SimulationConfiguration['perturbations'];
  };
  readonly fields: {
    readonly phase: ReturnType<typeof summarizeField>;
    readonly chemicalPotential: ReturnType<typeof summarizeField>;
    readonly solidificationTime: ReturnType<typeof summarizeField>;
  };
  readonly morphology: {
    readonly solidVoxelCount: number;
    readonly solidExtent: readonly [number, number, number];
    readonly symmetryError: number;
    readonly faceCenterDepression: number;
    readonly minimumFaceCenterDepression: number;
    readonly maximumFaceCenterDepression: number;
    readonly boundaryClearance: number;
    readonly boundaryClearanceRatio: number;
    readonly surfaceVoxelCount: number;
    readonly boundingBoxFillFraction: number;
    readonly surfaceToVolumeRatio: number;
    readonly surfaceComplexity: number;
    readonly faceReach: number;
    readonly edgeReach: number;
    readonly bodyDiagonalReach: number;
    readonly bodyDiagonalToFaceReachRatio: number;
    readonly occupiedBodyDiagonalArms: number;
    readonly connectedComponentCount: number;
    readonly largestConnectedComponentFraction: number;
  };
  readonly expectation: ReturnType<typeof evaluateExpectedMorphology>;
  readonly maturity: {
    readonly targetRadiusMultiple: number | null;
    readonly checkpointSteps: number;
    readonly completionReason: 'target-reach' | 'max-steps';
    readonly checkpoints: readonly {
      readonly step: number;
      readonly simulatedTime: number;
      readonly radiusMultiple: number;
      readonly maximumDirectionalReach: number;
      readonly faceReach: number;
      readonly edgeReach: number;
      readonly bodyDiagonalReach: number;
      readonly farBoundaryClearanceRatio: number;
    }[];
  };
  readonly timings: SolverStepTimings;
  readonly runtime: {
    readonly budgetMilliseconds: number | null;
    readonly fixtureWallMilliseconds: number;
    readonly passed: boolean;
  };
  readonly profileValidation: ValidationProfileResult | null;
  readonly uncapturedErrors: readonly string[];
  readonly passed: boolean;
}

export type SingleCrystalFixtureOutcome =
  | { readonly ok: true; readonly result: SingleCrystalFixtureResult }
  | {
      readonly ok: false;
      readonly error: {
        readonly name: string;
        readonly message: string;
        readonly stack: string | null;
        readonly browser: string;
      };
    };

declare global {
  interface Window {
    __BISMUTH_SINGLE_CRYSTAL__?: Promise<SingleCrystalFixtureOutcome>;
  }
}

interface SurfaceVoxel {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly birth: number;
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === null) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new RangeError(`Invalid integer fixture query value: ${value}.`);
  }
  return parsed;
}

function parsePositiveNumber(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === null) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new RangeError(`Invalid positive fixture query value: ${value}.`);
  }
  return parsed;
}

function parseFiniteNumber(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === null) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function parseFixtureConfiguration(): {
  readonly mode: FixtureMode;
  readonly expectedMorphology: SimulationPresetName;
  readonly configuration: DerivedSimulationConfiguration;
  readonly steps: number;
  readonly targetRadiusMultiple: number | null;
  readonly checkpointSteps: number;
  readonly maximumWallTimeMilliseconds: number | null;
  readonly reportMode: boolean;
  readonly validationProfile: ValidationProfile | null;
} {
  const query = new URLSearchParams(location.search);
  const requestedProfile = query.get('profile');
  if (
    requestedProfile !== null &&
    requestedProfile !== 'hopper-quick' &&
    requestedProfile !== 'hopper-reference' &&
    requestedProfile !== 'hopper-acceptance' &&
    requestedProfile !== 'dl4-screen-control' &&
    requestedProfile !== 'dl4-screen-quick' &&
    requestedProfile !== 'dl4-screen-reference'
  ) {
    throw new RangeError(`Invalid validation profile: ${requestedProfile}.`);
  }
  const requestedMode = query.get('mode');
  if (
    requestedMode !== null &&
    requestedMode !== 'baseline' &&
    requestedMode !== 'perturbed'
  ) {
    throw new RangeError(`Invalid morphology fixture mode: ${requestedMode}.`);
  }
  const mode: FixtureMode =
    requestedMode === 'baseline' ? 'baseline' : 'perturbed';
  const requestedExpected = query.get('expected');
  if (
    requestedExpected !== null &&
    !['cube', 'hopper', 'fractal', 'dendritic'].includes(requestedExpected)
  ) {
    throw new RangeError(`Invalid expected morphology: ${requestedExpected}.`);
  }
  const expectedMorphology = (requestedExpected ??
    'hopper') as SimulationPresetName;
  const requestedOperator = query.get('operator');
  if (
    requestedOperator !== null &&
    requestedOperator !== 'conservative-flux' &&
    requestedOperator !== 'author-centered'
  ) {
    throw new RangeError(`Invalid phase operator: ${requestedOperator}.`);
  }
  const requestedDomain = query.get('domain');
  if (
    requestedDomain !== null &&
    requestedDomain !== 'full' &&
    requestedDomain !== 'octant'
  ) {
    throw new RangeError(`Invalid domain mode: ${requestedDomain}.`);
  }
  const domainMode = requestedDomain === 'octant' ? 'octant' : 'full';
  const gridSize = parsePositiveInteger(query.get('grid'), 64, 24, 256);
  const steps = parsePositiveInteger(query.get('steps'), 6000, 1, 500_000);
  const targetRadiusMultiple =
    query.get('target-radius-multiple') === null
      ? null
      : parsePositiveNumber(query.get('target-radius-multiple'), 10, 1, 20);
  const checkpointSteps = parsePositiveInteger(
    query.get('checkpoint-steps'),
    targetRadiusMultiple === null ? steps : 5000,
    1,
    steps,
  );
  const maximumWallTimeMilliseconds =
    query.get('max-wall-ms') === null
      ? null
      : parsePositiveInteger(query.get('max-wall-ms'), 25_000, 1000, 600_000);
  const seed = parsePositiveInteger(
    query.get('seed'),
    0x5eeda11,
    0,
    0xffff_ffff,
  );
  const timeStep = parsePositiveNumber(query.get('dt'), 0.002, 0.00001, 0.01);
  const spacing = parsePositiveNumber(query.get('spacing'), 1, 0.25, 4);
  const lengthScale = query.get('high-resolution') === '1' ? 2 : 1;
  const base = createSimulationConfiguration(expectedMorphology);
  const liquidDiffusivity = parsePositiveNumber(
    query.get('dl'),
    base.parameters.liquidDiffusivity,
    0.001,
    20,
  );
  const farFieldChemicalPotential = parseFiniteNumber(
    query.get('mu'),
    base.parameters.farFieldChemicalPotential,
    -0.6,
    1,
  );
  const surfaceEnergyScale = parsePositiveNumber(
    query.get('surface-scale'),
    base.parameters.surfaceEnergyScale,
    0.01,
    2,
  );
  const configuration: SimulationConfiguration = {
    ...base,
    phaseOperator:
      requestedOperator === 'author-centered'
        ? 'author-centered'
        : 'conservative-flux',
    domainMode,
    parameters: {
      ...base.parameters,
      criticalRadius: 5 * lengthScale,
      initialRadius: 10 * lengthScale,
      interfaceWidth: lengthScale,
      surfaceEnergyScale,
      liquidDiffusivity,
      farFieldChemicalPotential,
    },
    grid: {
      ...base.grid,
      shape: [gridSize, gridSize, gridSize],
      spacing,
      timeStep,
    },
    perturbations:
      mode === 'baseline'
        ? {
            ...base.perturbations,
            seed,
          }
        : {
            ...base.perturbations,
            seed,
            seedRadiusAmplitude: 0.3,
            seedRadiusCorrelationLength: 8,
            chemicalPotentialAmplitude: 0.006,
            chemicalPotentialCorrelationLength: 12,
            farFieldGradient: [0.00018, -0.0001, 0.00014],
          },
  };

  const derived = deriveSimulationConfiguration(configuration);
  if (targetRadiusMultiple !== null) {
    const targetReach = targetRadiusMultiple * derived.parameters.initialRadius;
    const farBoundaryDistance = Math.min(
      ...derived.domainMaximum.map((maximum, axis) =>
        derived.domainMode === 'octant'
          ? maximum
          : Math.min(
              maximum,
              Math.abs(derived.domainMinimum[axis] ?? Number.NaN),
            ),
      ),
    );
    if (farBoundaryDistance < 2 * targetReach) {
      throw new RangeError(
        'The maturity target requires a far boundary at least twice the target radius.',
      );
    }
  }

  return {
    mode,
    expectedMorphology,
    configuration: derived,
    steps,
    targetRadiusMultiple,
    checkpointSteps,
    maximumWallTimeMilliseconds,
    reportMode: query.get('report') === '1',
    validationProfile: requestedProfile,
  };
}

function gridIndex(
  x: number,
  y: number,
  z: number,
  shape: readonly [number, number, number],
): number {
  return x + shape[0] * (y + shape[1] * z);
}

function collectSurfaceVoxels(
  fields: GpuFieldState,
  configuration: DerivedSimulationConfiguration,
): SurfaceVoxel[] {
  const shape = configuration.grid.shape;
  const threshold = configuration.grid.solidificationThreshold;
  const [width, height, depth] = shape;
  const surface: SurfaceVoxel[] = [];
  const offsets = [
    [-1, 0, 0],
    [1, 0, 0],
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [0, 0, 1],
  ] as const;

  for (let z = 1; z < depth - 1; z += 1) {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = gridIndex(x, y, z, shape);
        const phase = fields.phase[index] ?? Number.NaN;
        if (!(phase <= threshold)) {
          continue;
        }

        const touchesLiquid = offsets.some(([dx, dy, dz]) => {
          const neighbor =
            fields.phase[gridIndex(x + dx, y + dy, z + dz, shape)];
          return neighbor !== undefined && neighbor > threshold;
        });
        if (touchesLiquid) {
          surface.push({
            x,
            y,
            z,
            birth: fields.solidificationTime[index] ?? 0,
          });
        }
      }
    }
  }

  return surface;
}

function createSurfaceMesh(
  surface: readonly SurfaceVoxel[],
  configuration: DerivedSimulationConfiguration,
): InstancedMesh {
  const [width, height, depth] = configuration.grid.shape;
  const maximumDimension = Math.max(width, height, depth);
  const cellSize = 3.2 / maximumDimension;
  const geometry = new BoxGeometry(
    cellSize * 1.04,
    cellSize * 1.04,
    cellSize * 1.04,
  );
  const material = new MeshStandardMaterial({
    color: 0xb9c8cc,
    metalness: 0.72,
    roughness: 0.31,
  });
  const mesh = new InstancedMesh(geometry, material, surface.length);
  mesh.name = 'Developer phase-field surface voxels';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const matrix = new Matrix4();
  const center =
    configuration.domainMode === 'octant'
      ? [0, 0, 0]
      : [(width - 1) / 2, (height - 1) / 2, (depth - 1) / 2];

  surface.forEach((voxel, index) => {
    matrix.makeTranslation(
      (voxel.x - (center[0] ?? 0)) * cellSize,
      (voxel.y - (center[1] ?? 0)) * cellSize,
      (voxel.z - (center[2] ?? 0)) * cellSize,
    );
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function drawDiagnosticSlice(
  canvas: HTMLCanvasElement,
  fields: GpuFieldState,
  configuration: DerivedSimulationConfiguration,
  plane: 'xy' | 'xz' | 'yz',
): void {
  const shape = configuration.grid.shape;
  const [width, height, depth] = shape;
  const planeWidth = plane === 'yz' ? height : width;
  const planeHeight = plane === 'xy' ? height : depth;
  canvas.width = planeWidth;
  canvas.height = planeHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const pixels = context.createImageData(planeWidth, planeHeight);
  const centerX =
    configuration.domainMode === 'octant' ? 0 : Math.floor(width / 2);
  const centerY =
    configuration.domainMode === 'octant' ? 0 : Math.floor(height / 2);
  const centerZ =
    configuration.domainMode === 'octant' ? 0 : Math.floor(depth / 2);
  const muFar = configuration.parameters.farFieldChemicalPotential;
  const muRange = Math.max(
    configuration.parameters.equilibriumChemicalPotential - muFar,
    1e-6,
  );

  for (let v = 0; v < planeHeight; v += 1) {
    for (let u = 0; u < planeWidth; u += 1) {
      const coordinate =
        plane === 'xy'
          ? [u, planeHeight - 1 - v, centerZ]
          : plane === 'xz'
            ? [u, centerY, planeHeight - 1 - v]
            : [centerX, u, planeHeight - 1 - v];
      const sourceIndex = gridIndex(
        coordinate[0] ?? 0,
        coordinate[1] ?? 0,
        coordinate[2] ?? 0,
        shape,
      );
      const phase = fields.phase[sourceIndex] ?? 1;
      const chemicalPotential = fields.chemicalPotential[sourceIndex] ?? muFar;
      const solid = Math.min(1, Math.max(0, 1 - phase));
      const interfaceBand = Math.exp(-Math.abs(phase - 0.5) * 18);
      const normalizedMu = Math.min(
        1,
        Math.max(0, (chemicalPotential - muFar) / muRange),
      );
      const targetIndex = (u + planeWidth * v) * 4;
      pixels.data[targetIndex] = Math.round(
        7 + normalizedMu * 64 + solid * 126 + interfaceBand * 58,
      );
      pixels.data[targetIndex + 1] = Math.round(
        12 + normalizedMu * 93 + solid * 124 + interfaceBand * 72,
      );
      pixels.data[targetIndex + 2] = Math.round(
        20 + (1 - normalizedMu) * 72 + solid * 118,
      );
      pixels.data[targetIndex + 3] = 255;
    }
  }

  context.putImageData(pixels, 0, 0);
}

function sumTimings(
  accumulated: SolverStepTimings,
  next: SolverStepTimings,
): SolverStepTimings {
  return {
    steps: accumulated.steps + next.steps,
    phaseMilliseconds: accumulated.phaseMilliseconds + next.phaseMilliseconds,
    chemicalPotentialMilliseconds:
      accumulated.chemicalPotentialMilliseconds +
      next.chemicalPotentialMilliseconds,
    solidificationTimeMilliseconds:
      accumulated.solidificationTimeMilliseconds +
      next.solidificationTimeMilliseconds,
    totalMilliseconds: accumulated.totalMilliseconds + next.totalMilliseconds,
  };
}

async function runSingleCrystalFixture(
  canvas: HTMLCanvasElement,
  status: HTMLElement,
  progress: HTMLElement,
  readout: HTMLElement,
  sliceCanvases: readonly HTMLCanvasElement[],
): Promise<SingleCrystalFixtureResult> {
  const fixtureStartedAt = performance.now();
  const fixture = parseFixtureConfiguration();
  let session: WebGpuSession | undefined;
  let solver: GpuSingleCrystalSolver | undefined;
  let surfaceMesh: InstancedMesh | undefined;

  try {
    session = await createWebGpuSession(canvas);
    solver = createGpuSingleCrystalSolver(
      session.renderer,
      session.device,
      fixture.configuration,
    );
    await solver.initialize();
    const batchSize = Math.min(100, fixture.steps);
    let timings: SolverStepTimings = {
      steps: 0,
      phaseMilliseconds: 0,
      chemicalPotentialMilliseconds: 0,
      solidificationTimeMilliseconds: 0,
      totalMilliseconds: 0,
    };
    const maturityCheckpoints: SingleCrystalFixtureResult['maturity']['checkpoints'][number][] =
      [];
    let completionReason: 'target-reach' | 'max-steps' = 'max-steps';
    let completed = 0;

    while (completed < fixture.steps) {
      const stepsToCheckpoint =
        fixture.checkpointSteps - (completed % fixture.checkpointSteps);
      const count = Math.min(
        batchSize,
        fixture.steps - completed,
        stepsToCheckpoint,
      );
      timings = sumTimings(timings, await solver.step(count));
      completed += count;
      const percent = (completed / fixture.steps) * 100;
      progress.style.setProperty('--progress', `${percent.toFixed(2)}%`);
      status.textContent = `Evolving the ${fixture.mode} field: ${completed.toLocaleString()} / ${fixture.steps.toLocaleString()} steps`;
      if (!fixture.reportMode) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }
      const elapsedMilliseconds = performance.now() - fixtureStartedAt;
      if (
        fixture.maximumWallTimeMilliseconds !== null &&
        elapsedMilliseconds > fixture.maximumWallTimeMilliseconds
      ) {
        throw new Error(
          `Morphology fixture exceeded its ${fixture.maximumWallTimeMilliseconds} ms wall-time budget after ${completed} of ${fixture.steps} steps (${elapsedMilliseconds.toFixed(1)} ms).`,
        );
      }

      if (
        fixture.targetRadiusMultiple !== null &&
        (completed % fixture.checkpointSteps === 0 ||
          completed === fixture.steps)
      ) {
        status.textContent = `Measuring maturity at ${completed.toLocaleString()} steps...`;
        const phaseCheckpoint = await solver.readPhase();
        const maturity = measureGrowthMaturity(
          phaseCheckpoint.phase,
          fixture.configuration,
        );
        maturityCheckpoints.push({
          step: phaseCheckpoint.stepCount,
          simulatedTime: phaseCheckpoint.simulatedTime,
          radiusMultiple: maturity.radiusMultiple,
          maximumDirectionalReach: maturity.maximumDirectionalReach,
          faceReach: maturity.directionalReach.meanFace,
          edgeReach: maturity.directionalReach.meanEdge,
          bodyDiagonalReach: maturity.directionalReach.meanBodyDiagonal,
          farBoundaryClearanceRatio: maturity.farBoundaryClearanceRatio,
        });
        if (
          fixture.targetRadiusMultiple !== null &&
          maturity.radiusMultiple >= fixture.targetRadiusMultiple
        ) {
          completionReason = 'target-reach';
          break;
        }
      }
    }

    status.textContent = 'Reading the fixed diagnostic checkpoint...';
    const fields = await solver.readFields();
    solver.dispose();
    solver = undefined;

    const phaseSummary = summarizeField(fields.phase);
    const chemicalPotentialSummary = summarizeField(fields.chemicalPotential);
    const solidificationSummary = summarizeField(fields.solidificationTime);
    const solidBounds = measureSolidBounds(fields.phase, fixture.configuration);
    const finalMaturity = measureGrowthMaturity(
      fields.phase,
      fixture.configuration,
    );
    if (maturityCheckpoints.at(-1)?.step !== fields.stepCount) {
      maturityCheckpoints.push({
        step: fields.stepCount,
        simulatedTime: fields.simulatedTime,
        radiusMultiple: finalMaturity.radiusMultiple,
        maximumDirectionalReach: finalMaturity.maximumDirectionalReach,
        faceReach: finalMaturity.directionalReach.meanFace,
        edgeReach: finalMaturity.directionalReach.meanEdge,
        bodyDiagonalReach: finalMaturity.directionalReach.meanBodyDiagonal,
        farBoundaryClearanceRatio: finalMaturity.farBoundaryClearanceRatio,
      });
    }
    if (
      fixture.targetRadiusMultiple !== null &&
      finalMaturity.radiusMultiple >= fixture.targetRadiusMultiple
    ) {
      completionReason = 'target-reach';
    }
    const symmetry = measureSymmetry(
      fields.phase,
      fixture.configuration.grid.shape,
      fixture.configuration.domainMode,
    );
    const faceCenterDepression = measureFaceCenterDepression(
      fields.phase,
      fixture.configuration,
    );
    const transition = measureTransitionMorphology(
      fields.phase,
      fixture.configuration,
    );
    const expectation = evaluateExpectedMorphology(
      fixture.expectedMorphology,
      transition,
      faceCenterDepression,
      fixture.configuration,
    );
    const surface = collectSurfaceVoxels(fields, fixture.configuration);
    const solidHalfExtent = Math.max(...solidBounds.extent) / 2;
    const boundaryClearance = Math.min(
      ...fixture.configuration.domainMaximum.map(
        (maximum, axis) =>
          maximum -
          (fixture.configuration.domainMode === 'octant'
            ? (solidBounds.maximum[axis] ?? Number.NaN)
            : Math.max(
                Math.abs(solidBounds.minimum[axis] ?? Number.NaN),
                Math.abs(solidBounds.maximum[axis] ?? Number.NaN),
              )),
      ),
    );
    const boundaryClearanceRatio =
      solidHalfExtent > 0 ? boundaryClearance / solidHalfExtent : 0;

    sliceCanvases.forEach((sliceCanvas, index) => {
      drawDiagnosticSlice(
        sliceCanvas,
        fields,
        fixture.configuration,
        (['xy', 'xz', 'yz'] as const)[index] ?? 'xy',
      );
    });

    const scene = new Scene();
    scene.name = 'Step 1 developer morphology scene';
    scene.background = new Color(0x000000);
    const camera = new PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(3.6, 2.7, 4.2);
    camera.lookAt(0, 0, 0);
    const ambient = new AmbientLight(0x9dc4d1, 0.9);
    const key = new DirectionalLight(0xffe6d0, 4.4);
    key.position.set(4, 6, 5);
    const fill = new DirectionalLight(0x80b9d8, 2.2);
    fill.position.set(-4, 1, -3);
    scene.add(ambient, key, fill);
    if (surface.length > 0) {
      surfaceMesh = createSurfaceMesh(surface, fixture.configuration);
      scene.add(surfaceMesh);
    }

    const resize = () => {
      const width = Math.max(1, Math.floor(canvas.clientWidth));
      const height = Math.max(1, Math.floor(canvas.clientHeight));
      session?.renderer.setPixelRatio(
        Math.min(Math.max(window.devicePixelRatio, 1), 2),
      );
      session?.renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);
    session.renderer.shadowMap.enabled = true;
    session.renderer.toneMappingExposure = 1.15;
    await session.renderer.compileAsync(scene, camera);
    session.renderer.render(scene, camera);
    await session.device.queue.onSubmittedWorkDone();

    const orbitStart = performance.now();
    const render = () => {
      if (!session) {
        return;
      }
      const angle = (performance.now() - orbitStart) * 0.000045 + 0.66;
      const radius = 5.5;
      camera.position.set(
        Math.cos(angle) * radius,
        2.65,
        Math.sin(angle) * radius,
      );
      camera.lookAt(0, 0, 0);
      session.renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
    render();

    readout.innerHTML = `
      <div><strong>${surface.length.toLocaleString()}</strong><span>surface voxels</span></div>
      <div><strong>${faceCenterDepression.meanDepth.toFixed(2)}</strong><span>mean recess</span></div>
      <div><strong>${symmetry.maximum.toExponential(2)}</strong><span>symmetry error</span></div>
      <div><strong>${timings.totalMilliseconds.toFixed(0)} ms</strong><span>solver time</span></div>
    `;
    status.textContent = `${fixture.mode === 'baseline' ? 'Published symmetric control' : 'Physics-perturbed single crystal'} at t=${fields.simulatedTime.toFixed(2)}. Voxel surface is diagnostic only.`;

    const reportedConfiguration: SingleCrystalFixtureResult['configuration'] = {
      grid: fixture.configuration.grid.shape,
      workgroup: SOLVER_WORKGROUP_SIZE,
      precision: 'float32',
      spacing: fixture.configuration.grid.spacing,
      timeStep: fixture.configuration.grid.timeStep,
      steps: fixture.steps,
      simulatedTime: fields.simulatedTime,
      phaseOperator: fixture.configuration.phaseOperator,
      domainMode: fixture.configuration.domainMode,
      liquidDiffusivity: fixture.configuration.parameters.liquidDiffusivity,
      farFieldChemicalPotential:
        fixture.configuration.parameters.farFieldChemicalPotential,
      criticalRadius: fixture.configuration.parameters.criticalRadius,
      initialRadius: fixture.configuration.parameters.initialRadius,
      interfaceWidth: fixture.configuration.parameters.interfaceWidth,
      surfaceEnergyNormalization:
        fixture.configuration.surfaceEnergyNormalization,
      perturbations: fixture.configuration.perturbations,
    };
    const reportedFields: SingleCrystalFixtureResult['fields'] = {
      phase: phaseSummary,
      chemicalPotential: chemicalPotentialSummary,
      solidificationTime: solidificationSummary,
    };
    const reportedMorphology: SingleCrystalFixtureResult['morphology'] = {
      solidVoxelCount: solidBounds.voxelCount,
      solidExtent: solidBounds.extent,
      symmetryError: symmetry.maximum,
      faceCenterDepression: faceCenterDepression.meanDepth,
      minimumFaceCenterDepression: faceCenterDepression.minimumDepth,
      maximumFaceCenterDepression: faceCenterDepression.maximumDepth,
      boundaryClearance,
      boundaryClearanceRatio,
      surfaceVoxelCount: surface.length,
      boundingBoxFillFraction: transition.boundingBoxFillFraction,
      surfaceToVolumeRatio: transition.surfaceToVolumeRatio,
      surfaceComplexity: transition.surfaceComplexity,
      faceReach: transition.directionalReach.meanFace,
      edgeReach: transition.directionalReach.meanEdge,
      bodyDiagonalReach: transition.directionalReach.meanBodyDiagonal,
      bodyDiagonalToFaceReachRatio:
        transition.directionalReach.bodyDiagonalToFaceRatio,
      occupiedBodyDiagonalArms:
        transition.directionalReach.occupiedBodyDiagonalArms,
      connectedComponentCount: transition.connectedComponentCount,
      largestConnectedComponentFraction:
        transition.largestConnectedComponentFraction,
    };
    const nonFiniteCount =
      phaseSummary.nonFiniteCount +
      chemicalPotentialSummary.nonFiniteCount +
      solidificationSummary.nonFiniteCount;
    const fixtureWallMilliseconds = performance.now() - fixtureStartedAt;
    const runtime = {
      budgetMilliseconds: fixture.maximumWallTimeMilliseconds,
      fixtureWallMilliseconds,
      passed:
        fixture.maximumWallTimeMilliseconds === null ||
        fixtureWallMilliseconds <= fixture.maximumWallTimeMilliseconds,
    };
    const profileValidation = evaluateValidationProfile(
      fixture.validationProfile,
      fixture.mode,
      fixture.expectedMorphology,
      reportedConfiguration,
      reportedFields,
      reportedMorphology,
      runtime,
    );
    const passed =
      nonFiniteCount === 0 &&
      phaseSummary.minimum >= -0.02 &&
      phaseSummary.maximum <= 1.02 &&
      solidificationSummary.minimum >= -1 &&
      solidificationSummary.maximum <=
        fields.simulatedTime + fixture.configuration.grid.timeStep &&
      !solidBounds.empty &&
      surface.length > 0 &&
      (expectation.passed ||
        isScreeningValidationProfile(fixture.validationProfile)) &&
      (fixture.targetRadiusMultiple === null ||
        completionReason === 'target-reach') &&
      boundaryClearanceRatio >= 1 &&
      (fixture.mode === 'baseline'
        ? symmetry.maximum <= 1e-6
        : symmetry.maximum >= 1e-5 && symmetry.maximum <= 0.1) &&
      runtime.passed &&
      (profileValidation?.passed ?? true) &&
      session.errors.length === 0;

    return {
      mode: fixture.mode,
      validationProfile: fixture.validationProfile,
      expectedMorphology: fixture.expectedMorphology,
      diagnostics: session.diagnostics,
      configuration: reportedConfiguration,
      fields: reportedFields,
      morphology: reportedMorphology,
      expectation,
      maturity: {
        targetRadiusMultiple: fixture.targetRadiusMultiple,
        checkpointSteps: fixture.checkpointSteps,
        completionReason,
        checkpoints: maturityCheckpoints,
      },
      timings,
      runtime,
      profileValidation,
      uncapturedErrors: [...session.errors],
      passed,
    };
  } catch (error) {
    solver?.dispose();
    surfaceMesh?.geometry.dispose();
    if (Array.isArray(surfaceMesh?.material)) {
      surfaceMesh.material.forEach((material) => material.dispose());
    } else {
      surfaceMesh?.material.dispose();
    }
    session?.dispose();
    throw error;
  }
}

function serializeError(error: unknown): SingleCrystalFixtureOutcome {
  const normalized = error instanceof Error ? error : new Error(String(error));
  return {
    ok: false,
    error: {
      name: normalized.name,
      message: normalized.message,
      stack: normalized.stack ?? null,
      browser: navigator.userAgent,
    },
  };
}

export function mountSingleCrystalFixture(root: HTMLElement): void {
  root.innerHTML = `
    <main class="single-crystal-shell">
      <canvas class="single-crystal-canvas" aria-label="Single-crystal phase-field morphology"></canvas>
      <section class="single-crystal-header">
        <p class="eyebrow">Developer-only Step 1 validation</p>
        <h1>Published single-crystal solver</h1>
        <p data-single-crystal-status>Initializing the hardware solver...</p>
        <div class="single-crystal-progress" aria-hidden="true"><span data-single-crystal-progress></span></div>
      </section>
      <section class="single-crystal-diagnostics" aria-label="Orthogonal field diagnostics">
        <div class="single-crystal-slices">
          <div class="single-crystal-slice"><canvas data-slice="xy"></canvas><span>XY</span></div>
          <div class="single-crystal-slice"><canvas data-slice="xz"></canvas><span>XZ</span></div>
          <div class="single-crystal-slice"><canvas data-slice="yz"></canvas><span>YZ</span></div>
        </div>
        <div class="single-crystal-readout" data-single-crystal-readout></div>
      </section>
    </main>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>(
    '.single-crystal-canvas',
  );
  const status = root.querySelector<HTMLElement>(
    '[data-single-crystal-status]',
  );
  const progress = root.querySelector<HTMLElement>(
    '[data-single-crystal-progress]',
  );
  const readout = root.querySelector<HTMLElement>(
    '[data-single-crystal-readout]',
  );
  const slices = Array.from(
    root.querySelectorAll<HTMLCanvasElement>('[data-slice]'),
  );

  if (!canvas || !status || !progress || !readout || slices.length !== 3) {
    throw new Error('Unable to mount the single-crystal developer fixture.');
  }

  const query = new URLSearchParams(location.search);
  const reportToRunner = query.has('report');
  const runId = query.get('run');
  const startFixture = async () => {
    if (reportToRunner && runId) {
      const response = await fetch(
        `/__gpu-start?run=${encodeURIComponent(runId)}`,
        { method: 'POST' },
      );
      if (!response.ok) {
        throw new Error('Unable to start the budgeted morphology fixture.');
      }
    }
    return runSingleCrystalFixture(canvas, status, progress, readout, slices);
  };
  window.__BISMUTH_SINGLE_CRYSTAL__ = startFixture()
    .then((result): SingleCrystalFixtureOutcome => ({ ok: true, result }))
    .catch(serializeError);

  void window.__BISMUTH_SINGLE_CRYSTAL__.then((outcome) => {
    if (!outcome.ok) {
      status.textContent = `Solver failed: ${outcome.error.message}`;
    }
    if (reportToRunner && runId) {
      void fetch('/__gpu-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, outcome }),
      });
    }
  });
}
