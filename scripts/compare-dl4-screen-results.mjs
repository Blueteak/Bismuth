import { mkdir, readFile, writeFile } from 'node:fs/promises';

const inputPaths = {
  control: 'test-results/gpu/latest-dl4-screen-control.json',
  quick: 'test-results/gpu/latest-dl4-screen-quick.json',
  reference: 'test-results/gpu/latest-dl4-screen-reference.json',
};
const outputPath = 'test-results/gpu/latest-dl4-screen-comparison.json';

async function readResult(path, expectedProfile) {
  const outcome = JSON.parse(await readFile(path, 'utf8'));
  if (!outcome?.ok || !outcome.result?.passed) {
    throw new Error(`${path} does not contain a passing screen result.`);
  }
  if (
    outcome.result.validationProfile !== expectedProfile ||
    !outcome.result.profileValidation?.passed
  ) {
    throw new Error(`${path} does not match profile ${expectedProfile}.`);
  }
  return outcome.result;
}

function maximumAbsoluteDifference(left, right) {
  return Math.max(
    ...left.map((value, index) =>
      Math.abs(value - (right[index] ?? Number.NaN)),
    ),
  );
}

function relativeDifference(value, reference) {
  return reference === 0
    ? value === 0
      ? 0
      : Number.POSITIVE_INFINITY
    : (value - reference) / reference;
}

const [control, quick, reference] = await Promise.all([
  readResult(inputPaths.control, 'dl4-screen-control'),
  readResult(inputPaths.quick, 'dl4-screen-quick'),
  readResult(inputPaths.reference, 'dl4-screen-reference'),
]);

const controlMorphology = control.morphology;
const quickMorphology = quick.morphology;
const referenceMorphology = reference.morphology;
const temporal = {
  solidVoxelDelta:
    quickMorphology.solidVoxelCount - controlMorphology.solidVoxelCount,
  solidVoxelRelativeDelta: relativeDifference(
    quickMorphology.solidVoxelCount,
    controlMorphology.solidVoxelCount,
  ),
  surfaceVoxelDelta:
    quickMorphology.surfaceVoxelCount - controlMorphology.surfaceVoxelCount,
  surfaceVoxelRelativeDelta: relativeDifference(
    quickMorphology.surfaceVoxelCount,
    controlMorphology.surfaceVoxelCount,
  ),
  maximumExtentDelta: maximumAbsoluteDifference(
    quickMorphology.solidExtent,
    controlMorphology.solidExtent,
  ),
  faceRecessionDelta:
    quickMorphology.faceCenterDepression -
    controlMorphology.faceCenterDepression,
  fillDelta:
    quickMorphology.boundingBoxFillFraction -
    controlMorphology.boundingBoxFillFraction,
  surfaceComplexityDelta:
    quickMorphology.surfaceComplexity - controlMorphology.surfaceComplexity,
  reachDelta: {
    face: quickMorphology.faceReach - controlMorphology.faceReach,
    edge: quickMorphology.edgeReach - controlMorphology.edgeReach,
    bodyDiagonal:
      quickMorphology.bodyDiagonalReach - controlMorphology.bodyDiagonalReach,
  },
  bodyDiagonalToFaceRatioDelta:
    quickMorphology.bodyDiagonalToFaceReachRatio -
    controlMorphology.bodyDiagonalToFaceReachRatio,
};

const quickPhysicalVolumeProxy =
  quickMorphology.solidVoxelCount * quick.configuration.spacing ** 3;
const referencePhysicalVolumeProxy =
  referenceMorphology.solidVoxelCount * reference.configuration.spacing ** 3;
const quickPhysicalSurfaceProxy =
  quickMorphology.surfaceVoxelCount * quick.configuration.spacing ** 2;
const referencePhysicalSurfaceProxy =
  referenceMorphology.surfaceVoxelCount * reference.configuration.spacing ** 2;
const spatial = {
  domainMaximumDifference: Math.abs(
    (quick.configuration.grid[0] - 1) * quick.configuration.spacing -
      (reference.configuration.grid[0] - 1) * reference.configuration.spacing,
  ),
  maximumExtentDifference: maximumAbsoluteDifference(
    quickMorphology.solidExtent,
    referenceMorphology.solidExtent,
  ),
  maximumReachDifference: Math.max(
    Math.abs(quickMorphology.faceReach - referenceMorphology.faceReach),
    Math.abs(quickMorphology.edgeReach - referenceMorphology.edgeReach),
    Math.abs(
      quickMorphology.bodyDiagonalReach - referenceMorphology.bodyDiagonalReach,
    ),
  ),
  faceRecessionDifference: Math.abs(
    quickMorphology.faceCenterDepression -
      referenceMorphology.faceCenterDepression,
  ),
  physicalVolumeProxy: {
    quick: quickPhysicalVolumeProxy,
    reference: referencePhysicalVolumeProxy,
    relativeDifference: relativeDifference(
      quickPhysicalVolumeProxy,
      referencePhysicalVolumeProxy,
    ),
  },
  physicalSurfaceProxy: {
    quick: quickPhysicalSurfaceProxy,
    reference: referencePhysicalSurfaceProxy,
    relativeDifference: relativeDifference(
      quickPhysicalSurfaceProxy,
      referencePhysicalSurfaceProxy,
    ),
  },
  fillDifference: Math.abs(
    quickMorphology.boundingBoxFillFraction -
      referenceMorphology.boundingBoxFillFraction,
  ),
  surfaceComplexityDifference: Math.abs(
    quickMorphology.surfaceComplexity - referenceMorphology.surfaceComplexity,
  ),
  bodyDiagonalToFaceRatioDifference: Math.abs(
    quickMorphology.bodyDiagonalToFaceReachRatio -
      referenceMorphology.bodyDiagonalToFaceReachRatio,
  ),
  boundaryClearanceRatioDifference: Math.abs(
    quickMorphology.boundaryClearanceRatio -
      referenceMorphology.boundaryClearanceRatio,
  ),
};

const correlationFailures = [];
const requireCorrelation = (condition, message) => {
  if (!condition) correlationFailures.push(message);
};
requireCorrelation(
  spatial.domainMaximumDifference <= 1,
  'octant domain maxima differ by more than one physical unit',
);
requireCorrelation(
  spatial.maximumExtentDifference <= 4,
  'physical extent differs by more than 4',
);
requireCorrelation(
  spatial.maximumReachDifference <= 4,
  'directional reach differs by more than 4',
);
requireCorrelation(
  spatial.faceRecessionDifference <= 4,
  'face recession differs by more than 4',
);
requireCorrelation(
  Math.abs(spatial.physicalVolumeProxy.relativeDifference) <= 0.05,
  'physical volume proxy differs by more than 5%',
);
requireCorrelation(
  Math.abs(spatial.physicalSurfaceProxy.relativeDifference) <= 0.1,
  'physical surface proxy differs by more than 10%',
);
requireCorrelation(
  spatial.fillDifference <= 0.03,
  'bounding-box fill differs by more than 0.03',
);
requireCorrelation(
  spatial.surfaceComplexityDifference <= 0.3,
  'surface complexity differs by more than 0.3',
);
requireCorrelation(
  spatial.bodyDiagonalToFaceRatioDifference <= 0.03,
  'body-diagonal/face reach ratio differs by more than 0.03',
);
requireCorrelation(
  spatial.boundaryClearanceRatioDifference <= 0.15,
  'boundary-clearance ratio differs by more than 0.15',
);

const promotionSignals = [];
const fillImprovement = -temporal.fillDelta;
const ratioImprovement = temporal.bodyDiagonalToFaceRatioDelta;
const complexityImprovement = temporal.surfaceComplexityDelta;
if (fillImprovement >= 0.01 && fillImprovement > spatial.fillDifference) {
  promotionSignals.push('lower bounding-box fill');
}
if (
  ratioImprovement >= 0.03 &&
  ratioImprovement > spatial.bodyDiagonalToFaceRatioDifference
) {
  promotionSignals.push('higher body-diagonal/face reach ratio');
}
if (
  complexityImprovement >= 0.1 &&
  complexityImprovement > spatial.surfaceComplexityDifference
) {
  promotionSignals.push('higher surface complexity');
}

const comparison = {
  profiles: {
    control: control.validationProfile,
    quick: quick.validationProfile,
    reference: reference.validationProfile,
  },
  temporal,
  spatial,
  spatialCorrelation: {
    passed: correlationFailures.length === 0,
    failures: correlationFailures,
  },
  matureRefinementPromotion: {
    recommended:
      correlationFailures.length === 0 && promotionSignals.length > 0,
    signals: promotionSignals,
    reason:
      promotionSignals.length > 0
        ? 'The temporal change exceeds the spatial mismatch in at least one source-directed morphology descriptor.'
        : 'The temporal change is smaller than the spatial mismatch and does not move an early morphology descriptor toward the source dendrite.',
  },
  limitation:
    'This three-run matrix does not prove that temporal sensitivity is resolution-independent; that requires a 256^3, dx=1, dt=0.01 control.',
};

await mkdir('test-results/gpu', { recursive: true });
await writeFile(outputPath, `${JSON.stringify(comparison, null, 2)}\n`, 'utf8');
console.info(JSON.stringify(comparison, null, 2));

if (correlationFailures.length > 0) {
  throw new Error(
    `The D_L=4 quick/reference pair did not correlate: ${correlationFailures.join('; ')}.`,
  );
}
