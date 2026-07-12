import { mkdir, readFile, writeFile } from 'node:fs/promises';

const reports = {
  hopper: 'docs/evidence/step1-perturbed-reference-256.json',
  cubeConservative: 'docs/evidence/step1-transition-cube-conservative.json',
  fractalConservative:
    'docs/evidence/step1-transition-fractal-conservative.json',
  cubeAuthorCentered:
    'docs/evidence/step1-transition-cube-author-centered.json',
  fractalAuthorCentered:
    'docs/evidence/step1-transition-fractal-author-centered.json',
  dendriticAuthorCentered: 'docs/evidence/step1-dl4-octant-t1000.json',
};

async function loadResult(path) {
  const outcome = JSON.parse(await readFile(path, 'utf8'));
  if (!outcome.ok || !outcome.result) {
    throw new Error(
      `Transition evidence ${path} is not a successful fixture report.`,
    );
  }
  return outcome.result;
}

function summarize(expected, result, source) {
  return {
    expected,
    source,
    accepted: result.passed,
    failures: result.expectation?.failures ?? [],
    mode: result.mode,
    operator: result.configuration.phaseOperator ?? 'conservative-flux',
    domainMode: result.configuration.domainMode ?? 'full',
    grid: result.configuration.grid,
    spacing: result.configuration.spacing,
    timeStep: result.configuration.timeStep,
    simulatedTime: result.configuration.simulatedTime,
    liquidDiffusivity: result.configuration.liquidDiffusivity,
    solidExtent: result.morphology.solidExtent,
    solidVoxelCount: result.morphology.solidVoxelCount,
    boundingBoxFillFraction: result.morphology.boundingBoxFillFraction ?? null,
    faceCenterDepression: result.morphology.faceCenterDepression,
    surfaceComplexity: result.morphology.surfaceComplexity ?? null,
    bodyDiagonalToFaceReachRatio:
      result.morphology.bodyDiagonalToFaceReachRatio ?? null,
    occupiedBodyDiagonalArms:
      result.morphology.occupiedBodyDiagonalArms ?? null,
    connectedComponentCount: result.morphology.connectedComponentCount ?? null,
    phaseNonFiniteCount: result.fields.phase.nonFiniteCount,
    chemicalPotentialNonFiniteCount:
      result.fields.chemicalPotential.nonFiniteCount,
    uncapturedWebGpuErrors: result.uncapturedErrors.length,
    fixtureWallMilliseconds:
      result.runtime?.fixtureWallMilliseconds ??
      result.timings.totalMilliseconds,
  };
}

const loaded = Object.fromEntries(
  await Promise.all(
    Object.entries(reports).map(async ([name, path]) => [
      name,
      await loadResult(path),
    ]),
  ),
);

const outcomes = {
  hopper: summarize('hopper', loaded.hopper, reports.hopper),
  cubeConservative: summarize(
    'cube',
    loaded.cubeConservative,
    reports.cubeConservative,
  ),
  fractalConservative: summarize(
    'fractal',
    loaded.fractalConservative,
    reports.fractalConservative,
  ),
  cubeAuthorCentered: summarize(
    'cube',
    loaded.cubeAuthorCentered,
    reports.cubeAuthorCentered,
  ),
  fractalAuthorCentered: summarize(
    'fractal',
    loaded.fractalAuthorCentered,
    reports.fractalAuthorCentered,
  ),
  dendriticAuthorCentered: summarize(
    'dendritic',
    loaded.dendriticAuthorCentered,
    reports.dendriticAuthorCentered,
  ),
};

const failures = [];
if (!outcomes.hopper.accepted)
  failures.push('The accepted hopper did not pass.');
if (!outcomes.cubeConservative.accepted)
  failures.push('The conservative cube control did not pass.');
if (!outcomes.cubeAuthorCentered.accepted)
  failures.push('The author-centered cube control did not pass.');
if (outcomes.fractalConservative.accepted)
  failures.push(
    'The conservative fractal unexpectedly passed; review the recorded conclusion.',
  );
if (outcomes.fractalAuthorCentered.accepted)
  failures.push(
    'The author-centered fractal unexpectedly passed; review the recorded conclusion.',
  );
if (outcomes.dendriticAuthorCentered.accepted)
  failures.push(
    'The mature dendritic case unexpectedly passed; review the recorded conclusion.',
  );

for (const outcome of Object.values(outcomes)) {
  if (
    outcome.phaseNonFiniteCount !== 0 ||
    outcome.chemicalPotentialNonFiniteCount !== 0 ||
    outcome.uncapturedWebGpuErrors !== 0
  ) {
    failures.push(`${outcome.source} contains a numerical or WebGPU error.`);
  }
}

const result = {
  recordedAt: '2026-07-11',
  outcomes,
  stencilAB: {
    fractal: {
      conservative: {
        fill: outcomes.fractalConservative.boundingBoxFillFraction,
        complexity: outcomes.fractalConservative.surfaceComplexity,
        diagonalToFaceReach:
          outcomes.fractalConservative.bodyDiagonalToFaceReachRatio,
      },
      authorCentered: {
        fill: outcomes.fractalAuthorCentered.boundingBoxFillFraction,
        complexity: outcomes.fractalAuthorCentered.surfaceComplexity,
        diagonalToFaceReach:
          outcomes.fractalAuthorCentered.bodyDiagonalToFaceReachRatio,
      },
      interpretation:
        'The author-centered source stencil moves strongly toward the reported fractal but remains below the predeclared complexity gate.',
    },
  },
  conclusion: {
    validatedBrowserOutcomes: ['cube', 'hopper'],
    recordedButUnreproducedOutcomes: ['fractal', 'dendritic'],
    fullPublishedTransitionSeriesReproduced: false,
    milestoneEvidenceComplete: failures.length === 0,
    statement:
      'Step 1 reproduces its scoped single-hopper objective and the cube control. It does not reproduce the complete published transition series.',
  },
  limitations: [
    'The hopper evidence is the separately grid-refined accepted case; it is not a same-grid source-stencil transition run.',
    'The mature dendritic evidence uses an octant to reach a larger physical radius than the full-domain controls.',
    'The browser remains uniform-grid, explicit Euler, and Float32 rather than adaptive-mesh, implicit BDF2, and Float64.',
  ],
  passed: failures.length === 0,
  failures,
};

await mkdir('test-results/gpu', { recursive: true });
await writeFile(
  'test-results/gpu/latest-step1-transition-suite.json',
  `${JSON.stringify(result, null, 2)}\n`,
  'utf8',
);
console.info(JSON.stringify(result, null, 2));

if (!result.passed) {
  throw new Error(`Step 1 transition summary failed: ${failures.join('; ')}`);
}
