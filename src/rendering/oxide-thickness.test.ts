import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OXIDE_THICKNESS_MODEL,
  oxideSpatialField,
  surfaceAgeToOxideThickness,
  validateOxideThicknessModel,
  type OxideThicknessModel,
  type SurfacePosition,
} from './oxide-thickness';

const positions: readonly SurfacePosition[] = [
  [0, 0, 0],
  [32, -16, 8],
  [-128, 64, 96],
];

describe('surfaceAgeToOxideThickness', () => {
  it('starts at the configured baseline and clamps negative ages', () => {
    for (const position of positions) {
      expect(surfaceAgeToOxideThickness(0, position)).toBe(
        DEFAULT_OXIDE_THICKNESS_MODEL.minimumNanometers,
      );
      expect(surfaceAgeToOxideThickness(-10, position)).toBe(
        DEFAULT_OXIDE_THICKNESS_MODEL.minimumNanometers,
      );
    }
  });

  it('is monotonic at each fixed surface position', () => {
    const ages = [0, 1, 10, 45, 90, 180, 500, 10_000];

    for (const position of positions) {
      const thicknesses = ages.map((age) =>
        surfaceAgeToOxideThickness(age, position),
      );
      for (let index = 1; index < thicknesses.length; index += 1) {
        expect(thicknesses[index]).toBeGreaterThanOrEqual(
          thicknesses[index - 1] ?? Number.POSITIVE_INFINITY,
        );
      }
    }
  });

  it('keeps all samples inside the configured thickness bounds', () => {
    for (let coordinate = -512; coordinate <= 512; coordinate += 37) {
      const position: SurfacePosition = [
        coordinate,
        coordinate * -0.37,
        coordinate * 0.19,
      ];
      for (const age of [0, 10, 90, 500, 10_000]) {
        const thickness = surfaceAgeToOxideThickness(age, position);
        expect(thickness).toBeGreaterThanOrEqual(
          DEFAULT_OXIDE_THICKNESS_MODEL.minimumNanometers,
        );
        expect(thickness).toBeLessThanOrEqual(
          DEFAULT_OXIDE_THICKNESS_MODEL.maximumNanometers,
        );
      }
    }
  });

  it('uses deterministic bounded spatial variation', () => {
    const age = 90;
    const first = surfaceAgeToOxideThickness(
      age,
      positions[0] as SurfacePosition,
    );
    const second = surfaceAgeToOxideThickness(
      age,
      positions[1] as SurfacePosition,
    );

    expect(
      surfaceAgeToOxideThickness(age, positions[0] as SurfacePosition),
    ).toBe(first);
    expect(second).not.toBe(first);
    for (const position of positions) {
      expect(oxideSpatialField(position)).toBeGreaterThanOrEqual(-1);
      expect(oxideSpatialField(position)).toBeLessThanOrEqual(1);
    }
  });

  it('hits half of the configured span at halfRiseAge without variation', () => {
    const uniformModel: OxideThicknessModel = {
      ...DEFAULT_OXIDE_THICKNESS_MODEL,
      spatialVariation: 0,
    };
    const midpoint =
      (uniformModel.minimumNanometers + uniformModel.maximumNanometers) / 2;

    expect(
      surfaceAgeToOxideThickness(
        uniformModel.halfRiseAge,
        positions[0] as SurfacePosition,
        uniformModel,
      ),
    ).toBeCloseTo(midpoint, 12);
  });
});

describe('validateOxideThicknessModel', () => {
  it('accepts the default provisional model', () => {
    expect(validateOxideThicknessModel(DEFAULT_OXIDE_THICKNESS_MODEL)).toBe(
      DEFAULT_OXIDE_THICKNESS_MODEL,
    );
  });

  it.each([
    { ...DEFAULT_OXIDE_THICKNESS_MODEL, minimumNanometers: -1 },
    { ...DEFAULT_OXIDE_THICKNESS_MODEL, maximumNanometers: 40 },
    { ...DEFAULT_OXIDE_THICKNESS_MODEL, halfRiseAge: 0 },
    { ...DEFAULT_OXIDE_THICKNESS_MODEL, spatialVariation: 1 },
    { ...DEFAULT_OXIDE_THICKNESS_MODEL, spatialFrequency: 0 },
    { ...DEFAULT_OXIDE_THICKNESS_MODEL, spatialPhase: Number.NaN },
  ])('rejects an invalid parameter set', (model) => {
    expect(() => validateOxideThicknessModel(model)).toThrow();
  });
});
