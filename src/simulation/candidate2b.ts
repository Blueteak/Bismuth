/**
 * Candidate 2B sharp-surface incorporation isolation.
 *
 * Albani et al. (2019), Eq. (3), gives the quasi-stationary system
 *
 *   v = div_s(M grad_s(mu)) + F
 *   mu = mu_eq + tau(n) v.
 *
 * On a planar, unfolded side-top-side surface with mu_eq = 0 and constant M,
 * this becomes the linear finite-volume problem
 *
 *   mu / tau - M d2(mu) / ds2 = F.
 *
 * This module tests that sourced mechanism only. Its dimensionless values are
 * not calibrated bismuth data, and it is not coupled to Candidate 2A.
 */

export interface Candidate2BSurfaceIsolationConfiguration {
  /** Odd cell count keeps one cell exactly at the top-facet center. */
  readonly cellCount: number;
  /** Half-width of the central top facet in unfolded surface coordinates. */
  readonly topHalfWidth: number;
  /** Length of each adjoining slow side facet. */
  readonly sideLength: number;
  /** Isotropic surface mobility M. */
  readonly surfaceMobility: number;
  /** Dimensionless incorporation time on the top facet. */
  readonly topIncorporationTime: number;
  /** Dimensionless incorporation time on both side facets. */
  readonly sideIncorporationTime: number;
  /** Material supply F on the top facet. */
  readonly topSupply: number;
  /** Material supply F on both side facets. */
  readonly sideSupply: number;
}

export interface Candidate2BSurfaceIsolationResult {
  readonly configuration: Candidate2BSurfaceIsolationConfiguration;
  readonly spacing: number;
  readonly coordinate: Float64Array;
  readonly incorporationTime: Float64Array;
  readonly supply: Float64Array;
  readonly chemicalPotential: Float64Array;
  readonly normalVelocity: Float64Array;
  /** Integral(v) - integral(F), normalized by max(integral(abs(F)), 1). */
  readonly normalizedSupplyBalanceError: number;
  /** Maximum normalized residual of mu/tau - M laplacian(mu) = F. */
  readonly normalizedEquationResidual: number;
}

export interface Candidate2BPerimeterMeasurement {
  readonly rimVelocity: number;
  readonly coreVelocity: number;
  /** rimVelocity / coreVelocity - 1. */
  readonly normalizedRimExcess: number;
  /** sqrt(M tau_top), the planar top-facet diffusion-length scale. */
  readonly topDiffusionLength: number;
}

export interface Candidate2BPerimeterMeasurementOptions {
  /** Width measured inward from each top-facet edge. */
  readonly rimBandWidth: number;
  /** Half-width of the band centered on the top-facet center. */
  readonly coreHalfWidth: number;
}

/**
 * Dimensionless tau ratio and flux magnitude borrowed from Albani et al.'s
 * Figure 9 discriminator: the side facets have ten times the incorporation
 * time of the top facet. Unlike Figure 9's directional incident flux, this
 * isolation supplies every unfolded facet uniformly so the signal comes only
 * from incorporation contrast and tangential redistribution. The geometry is
 * wider than the top diffusion length so edge feeding is not spatially
 * uniform across the top.
 */
export const CANDIDATE2B_PERIMETER_ISOLATION = Object.freeze({
  cellCount: 801,
  topHalfWidth: 2,
  sideLength: 4,
  surfaceMobility: 0.1,
  topIncorporationTime: 1,
  sideIncorporationTime: 10,
  topSupply: 0.5,
  sideSupply: 0.5,
}) satisfies Candidate2BSurfaceIsolationConfiguration;

/** Declared before evaluating the fixed isolation. */
export const CANDIDATE2B_PERIMETER_GATES = Object.freeze({
  rimBandWidth: 0.4,
  coreHalfWidth: 0.4,
  minimumNormalizedRimExcess: 0.05,
  maximumNormalizedBalanceError: 1e-12,
  maximumNormalizedEquationResidual: 1e-11,
  maximumRefinementDifference: 0.01,
});

function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number.`);
  }
}

function assertFiniteNonnegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and nonnegative.`);
  }
}

export function validateCandidate2BSurfaceIsolationConfiguration(
  configuration: Candidate2BSurfaceIsolationConfiguration,
): void {
  if (
    !Number.isInteger(configuration.cellCount) ||
    configuration.cellCount < 5 ||
    configuration.cellCount % 2 !== 1
  ) {
    throw new RangeError('cellCount must be an odd integer >= 5.');
  }
  assertFinitePositive('topHalfWidth', configuration.topHalfWidth);
  assertFinitePositive('sideLength', configuration.sideLength);
  assertFiniteNonnegative('surfaceMobility', configuration.surfaceMobility);
  assertFinitePositive(
    'topIncorporationTime',
    configuration.topIncorporationTime,
  );
  assertFinitePositive(
    'sideIncorporationTime',
    configuration.sideIncorporationTime,
  );
  assertFiniteNonnegative('topSupply', configuration.topSupply);
  assertFiniteNonnegative('sideSupply', configuration.sideSupply);
}

function solveTridiagonal(
  lower: Float64Array,
  diagonal: Float64Array,
  upper: Float64Array,
  rightHandSide: Float64Array,
): Float64Array {
  const count = diagonal.length;
  const cPrime = new Float64Array(count);
  const dPrime = new Float64Array(count);
  const firstDiagonal = diagonal[0] ?? Number.NaN;
  cPrime[0] = (upper[0] ?? 0) / firstDiagonal;
  dPrime[0] = (rightHandSide[0] ?? Number.NaN) / firstDiagonal;

  for (let index = 1; index < count; index += 1) {
    const denominator =
      (diagonal[index] ?? Number.NaN) -
      (lower[index] ?? 0) * (cPrime[index - 1] ?? Number.NaN);
    if (!(denominator > 0) || !Number.isFinite(denominator)) {
      throw new RangeError('Surface-incorporation system is not positive.');
    }
    cPrime[index] = (upper[index] ?? 0) / denominator;
    dPrime[index] =
      ((rightHandSide[index] ?? Number.NaN) -
        (lower[index] ?? 0) * (dPrime[index - 1] ?? Number.NaN)) /
      denominator;
  }

  const solution = new Float64Array(count);
  solution[count - 1] = dPrime[count - 1] ?? Number.NaN;
  for (let index = count - 2; index >= 0; index -= 1) {
    solution[index] =
      (dPrime[index] ?? Number.NaN) -
      (cPrime[index] ?? 0) * (solution[index + 1] ?? Number.NaN);
  }
  return solution;
}

/**
 * Solves the planar sharp-surface Eq. (3) with zero tangential flux at the two
 * ends of the unfolded segment. Those endpoint conditions define this local
 * isolation; they are not claimed as an Albani trijunction boundary law.
 */
export function solveCandidate2BSurfaceIsolation(
  configuration: Candidate2BSurfaceIsolationConfiguration,
): Candidate2BSurfaceIsolationResult {
  validateCandidate2BSurfaceIsolationConfiguration(configuration);
  const {
    cellCount,
    topHalfWidth,
    sideLength,
    surfaceMobility,
    topIncorporationTime,
    sideIncorporationTime,
    topSupply,
    sideSupply,
  } = configuration;
  const halfLength = topHalfWidth + sideLength;
  const spacing = (2 * halfLength) / cellCount;
  const inverseSpacingSquared = 1 / spacing ** 2;
  const diffusionCoefficient = surfaceMobility * inverseSpacingSquared;
  const coordinate = new Float64Array(cellCount);
  const incorporationTime = new Float64Array(cellCount);
  const supply = new Float64Array(cellCount);
  const lower = new Float64Array(cellCount);
  const diagonal = new Float64Array(cellCount);
  const upper = new Float64Array(cellCount);

  for (let index = 0; index < cellCount; index += 1) {
    const position = -halfLength + (index + 0.5) * spacing;
    const onTop = Math.abs(position) <= topHalfWidth;
    const tau = onTop ? topIncorporationTime : sideIncorporationTime;
    coordinate[index] = position;
    incorporationTime[index] = tau;
    supply[index] = onTop ? topSupply : sideSupply;

    const neighborCount = (index > 0 ? 1 : 0) + (index + 1 < cellCount ? 1 : 0);
    diagonal[index] = 1 / tau + neighborCount * diffusionCoefficient;
    if (index > 0) lower[index] = -diffusionCoefficient;
    if (index + 1 < cellCount) upper[index] = -diffusionCoefficient;
  }

  const chemicalPotential = solveTridiagonal(lower, diagonal, upper, supply);
  const normalVelocity = new Float64Array(cellCount);
  let velocityIntegral = 0;
  let supplyIntegral = 0;
  let absoluteSupplyIntegral = 0;
  let maximumResidual = 0;
  let maximumEquationScale = 1;
  for (let index = 0; index < cellCount; index += 1) {
    const tau = incorporationTime[index] ?? Number.NaN;
    const velocity = (chemicalPotential[index] ?? Number.NaN) / tau;
    normalVelocity[index] = velocity;
    const localSupply = supply[index] ?? Number.NaN;
    velocityIntegral += velocity * spacing;
    supplyIntegral += localSupply * spacing;
    absoluteSupplyIntegral += Math.abs(localSupply) * spacing;

    const left =
      index > 0
        ? (chemicalPotential[index - 1] ?? Number.NaN)
        : (chemicalPotential[index] ?? Number.NaN);
    const center = chemicalPotential[index] ?? Number.NaN;
    const right =
      index + 1 < cellCount
        ? (chemicalPotential[index + 1] ?? Number.NaN)
        : center;
    const diffusion =
      surfaceMobility * (right - 2 * center + left) * inverseSpacingSquared;
    const residual = velocity - diffusion - localSupply;
    maximumResidual = Math.max(maximumResidual, Math.abs(residual));
    maximumEquationScale = Math.max(
      maximumEquationScale,
      Math.abs(velocity),
      Math.abs(diffusion),
      Math.abs(localSupply),
    );
  }

  return {
    configuration,
    spacing,
    coordinate,
    incorporationTime,
    supply,
    chemicalPotential,
    normalVelocity,
    normalizedSupplyBalanceError:
      Math.abs(velocityIntegral - supplyIntegral) /
      Math.max(absoluteSupplyIntegral, 1),
    normalizedEquationResidual: maximumResidual / maximumEquationScale,
  };
}

function intervalOverlap(
  lowerLeft: number,
  upperLeft: number,
  lowerRight: number,
  upperRight: number,
): number {
  return Math.max(
    0,
    Math.min(upperLeft, upperRight) - Math.max(lowerLeft, lowerRight),
  );
}

function averageVelocityOverAbsoluteBand(
  result: Candidate2BSurfaceIsolationResult,
  minimumDistance: number,
  maximumDistance: number,
): number {
  let sum = 0;
  let totalWeight = 0;
  const halfSpacing = result.spacing / 2;
  for (let index = 0; index < result.coordinate.length; index += 1) {
    const coordinate = result.coordinate[index] ?? Number.NaN;
    const cellLower = coordinate - halfSpacing;
    const cellUpper = coordinate + halfSpacing;
    const weight =
      intervalOverlap(cellLower, cellUpper, minimumDistance, maximumDistance) +
      intervalOverlap(cellLower, cellUpper, -maximumDistance, -minimumDistance);
    sum += (result.normalVelocity[index] ?? Number.NaN) * weight;
    totalWeight += weight;
  }
  if (!(totalWeight > 0)) {
    throw new RangeError('Measurement band contains no surface cells.');
  }
  return sum / totalWeight;
}

export function measureCandidate2BPerimeterSignal(
  result: Candidate2BSurfaceIsolationResult,
  options: Candidate2BPerimeterMeasurementOptions,
): Candidate2BPerimeterMeasurement {
  const { topHalfWidth, surfaceMobility, topIncorporationTime } =
    result.configuration;
  assertFinitePositive('rimBandWidth', options.rimBandWidth);
  assertFinitePositive('coreHalfWidth', options.coreHalfWidth);
  if (
    options.rimBandWidth >= topHalfWidth ||
    options.coreHalfWidth >= topHalfWidth ||
    options.rimBandWidth + options.coreHalfWidth >= topHalfWidth
  ) {
    throw new RangeError(
      'Rim and core bands must be disjoint top-facet bands.',
    );
  }
  const rimVelocity = averageVelocityOverAbsoluteBand(
    result,
    topHalfWidth - options.rimBandWidth,
    topHalfWidth,
  );
  const coreVelocity = averageVelocityOverAbsoluteBand(
    result,
    0,
    options.coreHalfWidth,
  );
  if (!(coreVelocity > 0) || !Number.isFinite(coreVelocity)) {
    throw new RangeError(
      'Normalized perimeter signal requires a finite positive core velocity.',
    );
  }
  return {
    rimVelocity,
    coreVelocity,
    normalizedRimExcess: rimVelocity / coreVelocity - 1,
    topDiffusionLength: Math.sqrt(surfaceMobility * topIncorporationTime),
  };
}
