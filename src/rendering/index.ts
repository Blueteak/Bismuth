/** Typed boundary for renderer and material ownership after milestone 0A. */
export interface RenderingSubsystem {
  readonly kind: 'rendering';
}

export {
  DEFAULT_OXIDE_THICKNESS_MODEL,
  OXIDE_SPATIAL_WAVES,
  oxideSpatialField,
  surfaceAgeToOxideThickness,
  validateOxideThicknessModel,
  type OxideThicknessModel,
  type OxideSpatialWave,
  type SurfacePosition,
} from './oxide-thickness';
export {
  BISMUTH_IRIDESCENCE_STRENGTH,
  BISMUTH_OXIDE_IOR,
  BISMUTH_ROUGHNESS,
  createBismuthPhysicalNodeMaterial,
  type BismuthMaterialOptions,
} from './bismuth-material';
