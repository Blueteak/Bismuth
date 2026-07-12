import {
  MeshPhysicalNodeMaterial,
  type StorageBufferAttribute,
} from 'three/webgpu';
import { float, storage, transformNormalToView, vec3 } from 'three/tsl';
import {
  DEFAULT_OXIDE_THICKNESS_MODEL,
  OXIDE_SPATIAL_WAVES,
  validateOxideThicknessModel,
  type OxideThicknessModel,
} from './oxide-thickness';

export const BISMUTH_IRIDESCENCE_STRENGTH = 0.72;
export const BISMUTH_ROUGHNESS = 0.3;
export const BISMUTH_OXIDE_IOR = 2.1;

export interface BismuthMaterialOptions {
  readonly positions: StorageBufferAttribute;
  readonly normalAge: StorageBufferAttribute;
  readonly vertexCapacity: number;
  readonly oxideModel?: OxideThicknessModel;
  readonly oxideThicknessOverrideNanometers?: number;
}

export function createBismuthPhysicalNodeMaterial(
  options: BismuthMaterialOptions,
): MeshPhysicalNodeMaterial {
  if (
    !Number.isInteger(options.vertexCapacity) ||
    options.vertexCapacity <= 0
  ) {
    throw new RangeError(
      'Material vertex capacity must be a positive integer.',
    );
  }
  const model = validateOxideThicknessModel(
    options.oxideModel ?? DEFAULT_OXIDE_THICKNESS_MODEL,
  );
  if (
    options.oxideThicknessOverrideNanometers !== undefined &&
    (!Number.isFinite(options.oxideThicknessOverrideNanometers) ||
      options.oxideThicknessOverrideNanometers < model.minimumNanometers ||
      options.oxideThicknessOverrideNanometers > model.maximumNanometers)
  ) {
    throw new RangeError(
      'Oxide thickness override must stay inside the configured range.',
    );
  }
  const positionAgeSource = storage(
    options.positions,
    'vec4',
    options.vertexCapacity,
  ).toAttribute();
  const normalAgeSource = storage(
    options.normalAge,
    'vec4',
    options.vertexCapacity,
  ).toAttribute();
  const position = positionAgeSource.xyz;
  const surfaceAge = normalAgeSource.w.max(0);

  const spatialField = OXIDE_SPATIAL_WAVES.map((wave) =>
    position
      .dot(vec3(...wave.direction))
      .mul(model.spatialFrequency * wave.frequencyScale)
      .add(model.spatialPhase * wave.phaseScale)
      .sin(),
  )
    .reduce((sum, wave) => sum.add(wave))
    .div(OXIDE_SPATIAL_WAVES.length);
  const localHalfRiseAge = float(model.halfRiseAge).mul(
    float(1).add(spatialField.mul(model.spatialVariation)),
  );
  const progress = float(1).sub(
    surfaceAge.div(localHalfRiseAge).negate().exp2(),
  );
  const oxideThickness =
    options.oxideThicknessOverrideNanometers === undefined
      ? float(model.minimumNanometers).add(
          progress.mul(model.maximumNanometers - model.minimumNanometers),
        )
      : float(options.oxideThicknessOverrideNanometers);

  const material = new MeshPhysicalNodeMaterial({
    color: 0xb9a9ad,
    metalness: 0.94,
    roughness: BISMUTH_ROUGHNESS,
    iridescence: BISMUTH_IRIDESCENCE_STRENGTH,
    iridescenceIOR: BISMUTH_OXIDE_IOR,
    iridescenceThicknessRange: [
      model.minimumNanometers,
      model.maximumNanometers,
    ],
  });
  material.name = 'Surface-age-driven bismuth physical node material';
  material.positionNode = position;
  material.normalNode = transformNormalToView(normalAgeSource.xyz).normalize();
  material.iridescenceNode = float(BISMUTH_IRIDESCENCE_STRENGTH);
  material.iridescenceThicknessNode = oxideThickness;

  return material;
}
