export interface EnvironmentPreset {
  readonly id: string;
  readonly hdriUrl: string;
  readonly environmentRotation: number;
  readonly exposure: number;
  readonly sunDirection: readonly [number, number, number];
  readonly sunIntensity: number;
  readonly sunColor: string;
}

export function validateEnvironmentPreset(
  preset: EnvironmentPreset,
): EnvironmentPreset {
  if (!preset.id || !preset.hdriUrl) {
    throw new Error('The environment preset requires an id and HDRI URL.');
  }

  const scalarValues = [
    preset.environmentRotation,
    preset.exposure,
    preset.sunIntensity,
    ...preset.sunDirection,
  ];

  if (scalarValues.some((value) => !Number.isFinite(value))) {
    throw new Error('The environment preset contains a non-finite value.');
  }

  if (preset.exposure <= 0 || preset.sunIntensity < 0) {
    throw new Error(
      'Environment exposure must be positive and light nonnegative.',
    );
  }

  if (preset.sunDirection.every((component) => component === 0)) {
    throw new Error('The directional light vector cannot be zero.');
  }

  if (!/^#[0-9a-f]{6}$/iu.test(preset.sunColor)) {
    throw new Error('The directional light color must use #RRGGBB notation.');
  }

  return preset;
}
