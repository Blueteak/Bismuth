import { mkdir, readFile, writeFile } from 'node:fs/promises';

const seeds = [99539473, 324508639, 610839776, 3221344269];
const expectedConfiguration = {
  grid: [128, 128, 128],
  spacing: 2,
  timeStep: 0.01,
  steps: 50000,
  simulatedTime: 500,
  phaseOperator: 'conservative-flux',
  domainMode: 'full',
  liquidDiffusivity: 1 / 12,
  farFieldChemicalPotential: 0.04,
};

function range(values) {
  return {
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    span: Math.max(...values) - Math.min(...values),
  };
}

function assertEqual(label, actual, expected, failures) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(
      `${label}=${JSON.stringify(actual)} did not match ${JSON.stringify(expected)}`,
    );
  }
}

const runs = [];
const failures = [];

for (const seed of seeds) {
  const path = `test-results/gpu/latest-morphology-seed-${seed}.json`;
  const outcome = JSON.parse(await readFile(path, 'utf8'));
  if (!outcome.ok) {
    failures.push(`Seed ${seed} fixture failed: ${outcome.error?.message}`);
    continue;
  }

  const result = outcome.result;
  const configuration = result.configuration;
  assertEqual(
    `Seed ${seed} grid`,
    configuration.grid,
    expectedConfiguration.grid,
    failures,
  );
  for (const name of [
    'spacing',
    'timeStep',
    'steps',
    'simulatedTime',
    'phaseOperator',
    'domainMode',
    'liquidDiffusivity',
    'farFieldChemicalPotential',
  ]) {
    assertEqual(
      `Seed ${seed} ${name}`,
      configuration[name],
      expectedConfiguration[name],
      failures,
    );
  }
  assertEqual(`Seed ${seed} mode`, result.mode, 'perturbed', failures);
  assertEqual(
    `Seed ${seed} perturbation seed`,
    configuration.perturbations.seed,
    seed,
    failures,
  );
  if (!result.passed || !result.expectation?.passed) {
    failures.push(
      `Seed ${seed} missed the hopper gate: ${result.expectation?.failures?.join('; ')}`,
    );
  }
  if (
    !result.runtime?.passed ||
    result.runtime.fixtureWallMilliseconds > 25000
  ) {
    failures.push(
      `Seed ${seed} exceeded the 25000 ms fixture budget (${result.runtime?.fixtureWallMilliseconds})`,
    );
  }
  if (result.uncapturedErrors.length > 0) {
    failures.push(`Seed ${seed} reported WebGPU errors`);
  }

  runs.push({
    seed,
    solidExtent: result.morphology.solidExtent,
    solidVoxelCount: result.morphology.solidVoxelCount,
    physicalVolumeProxy:
      result.morphology.solidVoxelCount * configuration.spacing ** 3,
    surfaceVoxelCount: result.morphology.surfaceVoxelCount,
    physicalSurfaceProxy:
      result.morphology.surfaceVoxelCount * configuration.spacing ** 2,
    meanFaceCenterDepression: result.morphology.faceCenterDepression,
    minimumFaceCenterDepression: result.morphology.minimumFaceCenterDepression,
    maximumFaceCenterDepression: result.morphology.maximumFaceCenterDepression,
    boundingBoxFillFraction: result.morphology.boundingBoxFillFraction,
    symmetryError: result.morphology.symmetryError,
    connectedComponentCount: result.morphology.connectedComponentCount,
    largestConnectedComponentFraction:
      result.morphology.largestConnectedComponentFraction,
    chemicalPotentialMaximum: result.fields.chemicalPotential.maximum,
    fixtureWallMilliseconds: result.runtime.fixtureWallMilliseconds,
    passed: result.passed,
  });
}

const signatures = new Set(
  runs.map((run) =>
    JSON.stringify([
      run.solidExtent,
      run.solidVoxelCount,
      run.surfaceVoxelCount,
      run.meanFaceCenterDepression,
      run.symmetryError,
    ]),
  ),
);
if (runs.length !== seeds.length) {
  failures.push(`Loaded ${runs.length} of ${seeds.length} seed reports`);
}
if (signatures.size < 2) {
  failures.push('The seed suite did not produce distinct morphology summaries');
}

const result = {
  configuration: expectedConfiguration,
  seeds,
  runs,
  ranges: {
    solidVoxelCount: range(runs.map((run) => run.solidVoxelCount)),
    physicalVolumeProxy: range(runs.map((run) => run.physicalVolumeProxy)),
    surfaceVoxelCount: range(runs.map((run) => run.surfaceVoxelCount)),
    physicalSurfaceProxy: range(runs.map((run) => run.physicalSurfaceProxy)),
    meanFaceCenterDepression: range(
      runs.map((run) => run.meanFaceCenterDepression),
    ),
    boundingBoxFillFraction: range(
      runs.map((run) => run.boundingBoxFillFraction),
    ),
    symmetryError: range(runs.map((run) => run.symmetryError)),
    chemicalPotentialMaximum: range(
      runs.map((run) => run.chemicalPotentialMaximum),
    ),
    fixtureWallMilliseconds: range(
      runs.map((run) => run.fixtureWallMilliseconds),
    ),
  },
  distinctMorphologySignatures: signatures.size,
  limitations: [
    'The four correlated modes vary phase with the seed but keep fixed wave-vector directions.',
    'This low-resolution suite validates hopper robustness and iteration cost; it is not four full-resolution convergence studies.',
  ],
  passed: failures.length === 0,
  failures,
};

await mkdir('test-results/gpu', { recursive: true });
await writeFile(
  'test-results/gpu/latest-hopper-seed-comparison.json',
  `${JSON.stringify(result, null, 2)}\n`,
  'utf8',
);
console.info(JSON.stringify(result, null, 2));

if (!result.passed) {
  throw new Error(`Hopper seed comparison failed: ${failures.join('; ')}`);
}
