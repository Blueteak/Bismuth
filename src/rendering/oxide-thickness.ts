export type SurfacePosition = readonly [number, number, number];

export interface OxideThicknessModel {
  readonly minimumNanometers: number;
  readonly maximumNanometers: number;
  readonly halfRiseAge: number;
  readonly spatialVariation: number;
  readonly spatialFrequency: number;
  readonly spatialPhase: number;
}

/**
 * Provisional material-study values. The final calibrated range remains
 * deferred until fixed-camera screenshots are compared with references.
 */
export const DEFAULT_OXIDE_THICKNESS_MODEL: OxideThicknessModel = Object.freeze(
  {
    minimumNanometers: 40,
    maximumNanometers: 600,
    halfRiseAge: 90,
    spatialVariation: 0.18,
    spatialFrequency: 0.85,
    spatialPhase: 1.37,
  },
);

export interface OxideSpatialWave {
  readonly direction: SurfacePosition;
  readonly frequencyScale: number;
  readonly phaseScale: number;
}

/** Balanced directions avoid a visible preferred axis in the oxide field. */
export const OXIDE_SPATIAL_WAVES: readonly OxideSpatialWave[] = Object.freeze([
  { direction: [0.754, 0.569, 0.325], frequencyScale: 1, phaseScale: 1 },
  {
    direction: [-0.251, 0.703, 0.665],
    frequencyScale: 0.61,
    phaseScale: 1.61803398875,
  },
  {
    direction: [0.473, -0.812, 0.341],
    frequencyScale: 0.79,
    phaseScale: 0.73,
  },
  {
    direction: [-0.622, -0.192, 0.759],
    frequencyScale: 1.13,
    phaseScale: 2.11,
  },
]);

export function validateOxideThicknessModel(
  model: OxideThicknessModel,
): OxideThicknessModel {
  const values = [
    model.minimumNanometers,
    model.maximumNanometers,
    model.halfRiseAge,
    model.spatialVariation,
    model.spatialFrequency,
    model.spatialPhase,
  ];

  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('The oxide-thickness model contains a non-finite value.');
  }
  if (model.minimumNanometers < 0) {
    throw new RangeError('Minimum oxide thickness cannot be negative.');
  }
  if (model.maximumNanometers <= model.minimumNanometers) {
    throw new RangeError('Maximum oxide thickness must exceed the minimum.');
  }
  if (model.halfRiseAge <= 0) {
    throw new RangeError('Oxide half-rise age must be positive.');
  }
  if (model.spatialVariation < 0 || model.spatialVariation >= 1) {
    throw new RangeError('Spatial variation must be in the range [0, 1).');
  }
  if (model.spatialFrequency <= 0) {
    throw new RangeError('Spatial frequency must be positive.');
  }

  return model;
}

function dot(position: SurfacePosition, direction: SurfacePosition): number {
  return (
    position[0] * direction[0] +
    position[1] * direction[1] +
    position[2] * direction[2]
  );
}

/** Returns a deterministic smooth field in [-1, 1]. */
export function oxideSpatialField(
  position: SurfacePosition,
  model: OxideThicknessModel = DEFAULT_OXIDE_THICKNESS_MODEL,
): number {
  if (position.some((component) => !Number.isFinite(component))) {
    throw new Error('Surface position contains a non-finite component.');
  }

  const waveSum = OXIDE_SPATIAL_WAVES.reduce(
    (sum, wave) =>
      sum +
      Math.sin(
        dot(position, wave.direction) *
          model.spatialFrequency *
          wave.frequencyScale +
          model.spatialPhase * wave.phaseScale,
      ),
    0,
  );

  return waveSum / OXIDE_SPATIAL_WAVES.length;
}

/**
 * Maps non-negative surface age to oxide thickness. Negative ages are treated
 * as newly solidified. At a fixed position the exponential curve is monotonic
 * and approaches, but never exceeds, maximumNanometers.
 */
export function surfaceAgeToOxideThickness(
  surfaceAge: number,
  position: SurfacePosition,
  model: OxideThicknessModel = DEFAULT_OXIDE_THICKNESS_MODEL,
): number {
  if (!Number.isFinite(surfaceAge)) {
    throw new Error('Surface age must be finite.');
  }

  const age = Math.max(0, surfaceAge);
  const localHalfRiseAge =
    model.halfRiseAge *
    (1 + model.spatialVariation * oxideSpatialField(position, model));
  const progress = -Math.expm1((-Math.LN2 * age) / localHalfRiseAge);

  return (
    model.minimumNanometers +
    (model.maximumNanometers - model.minimumNanometers) * progress
  );
}
