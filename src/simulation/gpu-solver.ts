import {
  FloatType,
  NearestFilter,
  RedFormat,
  Storage3DTexture,
  type ComputeNode,
  type Node,
  type WebGPURenderer,
} from 'three/webgpu';
import {
  Fn,
  If,
  clamp,
  float,
  int,
  instanceIndex,
  ivec3,
  max,
  storageTexture3D,
  textureStore,
  uniform,
  vec3,
  vec4,
} from 'three/tsl';
import {
  deriveSimulationConfiguration,
  type DerivedSimulationConfiguration,
  type SimulationConfiguration,
  type Vec3,
} from './config';
import { createPerturbationSignature } from './random';

export const SOLVER_WORKGROUP_SIZE = [4, 4, 4] as const;

export interface GpuSolverTextures {
  readonly phase: Storage3DTexture;
  readonly chemicalPotential: Storage3DTexture;
  readonly solidificationTime: Storage3DTexture;
}

export type GpuSolverTextureParity = 0 | 1;

export interface GpuSingleCrystalSolver {
  readonly configuration: DerivedSimulationConfiguration;
  readonly initialized: boolean;
  readonly simulatedTime: number;
  readonly stepCount: number;
  readonly currentTextures: GpuSolverTextures;
  readonly currentTextureParity: GpuSolverTextureParity;
  readonly textureParities: readonly [GpuSolverTextures, GpuSolverTextures];
  initialize(): Promise<void>;
  step(steps?: number): Promise<void>;
  dispose(): void;
}

interface SolverResourceSet {
  readonly phaseA: Storage3DTexture;
  readonly phaseB: Storage3DTexture;
  readonly chemicalPotentialA: Storage3DTexture;
  readonly chemicalPotentialB: Storage3DTexture;
  readonly solidificationTimeA: Storage3DTexture;
  readonly solidificationTimeB: Storage3DTexture;
  readonly initializeA: ComputeNode;
  readonly phaseAToB: ComputeNode;
  readonly phaseBToA: ComputeNode;
  readonly chemicalPotentialAToB: ComputeNode;
  readonly chemicalPotentialBToA: ComputeNode;
  readonly solidificationTimeAToB: ComputeNode;
  readonly solidificationTimeBToA: ComputeNode;
  readonly solidificationTimeValue: ReturnType<typeof uniform>;
  dispose(): void;
}

function createScalarStorageTexture(
  name: string,
  configuration: DerivedSimulationConfiguration,
): Storage3DTexture {
  const [width, height, depth] = configuration.grid.shape;
  const texture = new Storage3DTexture(width, height, depth);
  texture.name = name;
  texture.format = RedFormat;
  texture.type = FloatType;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

type FloatNode = Node<'float'>;
type Ivec3Node = Node<'ivec3'>;
type Vec3Node = Node<'vec3'>;

function writeScalar(
  texture: Storage3DTexture,
  coordinate: Ivec3Node,
  value: FloatNode,
) {
  // WGSL storage writes use a vec4 payload even for r32float; only .r is stored.
  textureStore(texture, coordinate, vec4(value, 0, 0, 1)).toWriteOnly();
}

function axisNode(axis: Vec3) {
  return vec3(axis[0], axis[1], axis[2]);
}

function createSolverResources(
  configuration: DerivedSimulationConfiguration,
): SolverResourceSet {
  const [width, height, depth] = configuration.grid.shape;
  const voxelCount = configuration.voxelCount;
  const spacing = configuration.grid.spacing;
  const inverseSpacing = 1 / spacing;
  const inverseFourSpacing = 1 / (4 * spacing);
  const inverseSpacingSquared = 1 / (spacing * spacing);
  const timeStep = configuration.grid.timeStep;
  const parameters = configuration.parameters;
  const farFieldGradient = configuration.perturbations.farFieldGradient;
  const radiusSignature = createPerturbationSignature(
    (configuration.perturbations.seed ^ 0x9e37_79b9) >>> 0,
  );
  const chemicalSignature = createPerturbationSignature(
    (configuration.perturbations.seed ^ 0x85eb_ca6b) >>> 0,
  );
  const crystalAxisX = axisNode(configuration.crystalAxes[0]);
  const crystalAxisY = axisNode(configuration.crystalAxes[1]);
  const crystalAxisZ = axisNode(configuration.crystalAxes[2]);
  const epsilonSquared = parameters.anisotropyRegularization ** 2;
  const minimumAnisotropyDenominator = 1e-12;

  const phaseA = createScalarStorageTexture(
    'Step 1 phase field A',
    configuration,
  );
  const phaseB = createScalarStorageTexture(
    'Step 1 phase field B',
    configuration,
  );
  const chemicalPotentialA = createScalarStorageTexture(
    'Step 1 chemical-potential field A',
    configuration,
  );
  const chemicalPotentialB = createScalarStorageTexture(
    'Step 1 chemical-potential field B',
    configuration,
  );
  const solidificationTimeA = createScalarStorageTexture(
    'Step 1 solidification-time field A',
    configuration,
  );
  const solidificationTimeB = createScalarStorageTexture(
    'Step 1 solidification-time field B',
    configuration,
  );

  const voxelCoordinate = Fn(() => {
    const x = int(instanceIndex.mod(width));
    const y = int(instanceIndex.div(width).mod(height));
    const z = int(instanceIndex.div(width * height));
    return ivec3(x, y, z);
  });

  const clampCoordinate = Fn(([coordinate]: [Ivec3Node]) =>
    ivec3(
      int(clamp(coordinate.x.toFloat(), 0, width - 1)),
      int(clamp(coordinate.y.toFloat(), 0, height - 1)),
      int(clamp(coordinate.z.toFloat(), 0, depth - 1)),
    ),
  );

  const positionAt = Fn(([coordinate]: [Ivec3Node]) =>
    coordinate
      .toVec3()
      .sub(
        configuration.domainMode === 'octant'
          ? vec3(0, 0, 0)
          : vec3((width - 1) / 2, (height - 1) / 2, (depth - 1) / 2),
      )
      .mul(spacing),
  );

  const isBoundary = Fn(([coordinate]: [Ivec3Node]) =>
    coordinate.x
      .equal(0)
      .or(coordinate.y.equal(0))
      .or(coordinate.z.equal(0))
      .or(coordinate.x.equal(width - 1))
      .or(coordinate.y.equal(height - 1))
      .or(coordinate.z.equal(depth - 1)),
  );

  const isFarBoundary = Fn(([coordinate]: [Ivec3Node]) =>
    configuration.domainMode === 'octant'
      ? coordinate.x
          .equal(width - 1)
          .or(coordinate.y.equal(height - 1))
          .or(coordinate.z.equal(depth - 1))
      : isBoundary(coordinate),
  );

  const isSymmetryBoundary = Fn(([coordinate]: [Ivec3Node]) =>
    configuration.domainMode === 'octant'
      ? coordinate.x
          .equal(0)
          .or(coordinate.y.equal(0))
          .or(coordinate.z.equal(0))
          .and(isFarBoundary(coordinate).not())
      : int(0).equal(1),
  );

  const nearestInteriorCoordinate = Fn(([coordinate]: [Ivec3Node]) =>
    ivec3(
      int(clamp(coordinate.x.toFloat(), 1, width - 2)),
      int(clamp(coordinate.y.toFloat(), 1, height - 2)),
      int(clamp(coordinate.z.toFloat(), 1, depth - 2)),
    ),
  );

  const farFieldAtNode = Fn(([position]: [Vec3Node]) =>
    float(parameters.farFieldChemicalPotential)
      .add(position.x.mul(farFieldGradient[0]))
      .add(position.y.mul(farFieldGradient[1]))
      .add(position.z.mul(farFieldGradient[2])),
  );

  const createCorrelatedPerturbation = (
    signature: ReturnType<typeof createPerturbationSignature>,
  ) =>
    Fn(([position, correlationLength]: [Vec3Node, FloatNode]) => {
      const inverseLength = float(1).div(max(correlationLength, 1e-6));
      const scaled = position.mul(inverseLength);
      return scaled.x
        .add(scaled.y.mul(0.73))
        .add(scaled.z.mul(0.37))
        .add(signature.phases[0])
        .sin()
        .mul(signature.weights[0])
        .add(
          scaled.y
            .sub(scaled.z.mul(0.61))
            .add(scaled.x.mul(0.19))
            .add(signature.phases[1])
            .sin()
            .mul(signature.weights[1]),
        )
        .add(
          scaled.z
            .add(scaled.x.mul(0.53))
            .sub(scaled.y.mul(0.29))
            .add(signature.phases[2])
            .sin()
            .mul(signature.weights[2]),
        )
        .add(
          scaled.x
            .sub(scaled.y.mul(0.47))
            .add(scaled.z.mul(0.83))
            .add(signature.phases[3])
            .sin()
            .mul(signature.weights[3]),
        )
        .mul(signature.normalization);
    });
  const seedRadiusPerturbation = createCorrelatedPerturbation(radiusSignature);
  const chemicalPotentialPerturbation =
    createCorrelatedPerturbation(chemicalSignature);

  const initializeA = Fn(() => {
    const coordinate = voxelCoordinate();
    const position = positionAt(coordinate);
    const farBoundary = isFarBoundary(coordinate);
    const symmetryBoundary = isSymmetryBoundary(coordinate);
    const phasePosition = positionAt(nearestInteriorCoordinate(coordinate));
    const chemicalPosition = position.toVar();
    If(symmetryBoundary, () => {
      chemicalPosition.assign(
        positionAt(nearestInteriorCoordinate(coordinate)),
      );
    });
    const seedPerturbation = seedRadiusPerturbation(
      phasePosition,
      float(configuration.perturbations.seedRadiusCorrelationLength),
    ).mul(configuration.perturbations.seedRadiusAmplitude);
    const radius = phasePosition.length();
    const seedRadius = float(parameters.initialRadius).add(seedPerturbation);
    const phase = float(1)
      .div(
        float(1).add(
          radius.sub(seedRadius).div(parameters.interfaceWidth).negate().exp(),
        ),
      )
      .toVar();
    const farField = farFieldAtNode(chemicalPosition);
    const chemicalPerturbation = chemicalPotentialPerturbation(
      phasePosition,
      float(configuration.perturbations.chemicalPotentialCorrelationLength),
    )
      .mul(configuration.perturbations.chemicalPotentialAmplitude)
      .mul(phase);
    const chemicalPotential = float(parameters.equilibriumChemicalPotential)
      .sub(
        phase.mul(float(parameters.equilibriumChemicalPotential).sub(farField)),
      )
      .add(chemicalPerturbation)
      .toVar();
    const solidificationTime = phase
      .lessThanEqual(configuration.grid.solidificationThreshold)
      .select(0, -1)
      .toVar();

    If(farBoundary, () => {
      chemicalPotential.assign(farFieldAtNode(position));
      solidificationTime.assign(-1);
    });

    writeScalar(phaseA, coordinate, phase);
    writeScalar(chemicalPotentialA, coordinate, chemicalPotential);
    writeScalar(solidificationTimeA, coordinate, solidificationTime);
  })().compute(voxelCount, [...SOLVER_WORKGROUP_SIZE]);

  const createPhasePass = (
    sourcePhase: Storage3DTexture,
    sourceChemicalPotential: Storage3DTexture,
    targetPhase: Storage3DTexture,
  ): ComputeNode => {
    const phaseAt = Fn(
      ([coordinate]: [Ivec3Node]) =>
        storageTexture3D(sourcePhase)
          .load(nearestInteriorCoordinate(coordinate))
          .toReadOnly().r,
    );
    const chemicalPotentialAt = Fn(
      ([coordinate]: [Ivec3Node]) =>
        storageTexture3D(sourceChemicalPotential)
          .load(clampCoordinate(coordinate))
          .toReadOnly().r,
    );

    const anisotropyFluxForGradient = Fn(([gradient]: [Vec3Node]) => {
      const crystalGradient = vec3(
        gradient.dot(crystalAxisX),
        gradient.dot(crystalAxisY),
        gradient.dot(crystalAxisZ),
      );
      const gradientSquared = gradient.dot(gradient);
      const qx = crystalGradient.x
        .mul(crystalGradient.x)
        .add(gradientSquared.mul(epsilonSquared))
        .sqrt();
      const qy = crystalGradient.y
        .mul(crystalGradient.y)
        .add(gradientSquared.mul(epsilonSquared))
        .sqrt();
      const qz = crystalGradient.z
        .mul(crystalGradient.z)
        .add(gradientSquared.mul(epsilonSquared))
        .sqrt();
      const inverseSum = float(1)
        .div(max(qx, minimumAnisotropyDenominator))
        .add(float(1).div(max(qy, minimumAnisotropyDenominator)))
        .add(float(1).div(max(qz, minimumAnisotropyDenominator)));
      return crystalAxisX
        .mul(crystalGradient.x.div(max(qx, minimumAnisotropyDenominator)))
        .add(
          crystalAxisY.mul(
            crystalGradient.y.div(max(qy, minimumAnisotropyDenominator)),
          ),
        )
        .add(
          crystalAxisZ.mul(
            crystalGradient.z.div(max(qz, minimumAnisotropyDenominator)),
          ),
        )
        .add(gradient.mul(epsilonSquared).mul(inverseSum))
        .mul(qx.add(qy).add(qz));
    });

    const authorCenteredDivergenceAt = Fn(([coordinate]: [Ivec3Node]) => {
      const center = phaseAt(coordinate);
      const xp = phaseAt(coordinate.add(ivec3(1, 0, 0)));
      const xm = phaseAt(coordinate.sub(ivec3(1, 0, 0)));
      const yp = phaseAt(coordinate.add(ivec3(0, 1, 0)));
      const ym = phaseAt(coordinate.sub(ivec3(0, 1, 0)));
      const zp = phaseAt(coordinate.add(ivec3(0, 0, 1)));
      const zm = phaseAt(coordinate.sub(ivec3(0, 0, 1)));
      const gradient = vec3(
        xp.sub(xm).mul(0.5 * inverseSpacing),
        yp.sub(ym).mul(0.5 * inverseSpacing),
        zp.sub(zm).mul(0.5 * inverseSpacing),
      );
      const hxx = xp.sub(center.mul(2)).add(xm).mul(inverseSpacingSquared);
      const hyy = yp.sub(center.mul(2)).add(ym).mul(inverseSpacingSquared);
      const hzz = zp.sub(center.mul(2)).add(zm).mul(inverseSpacingSquared);
      const mixedScale = 0.25 * inverseSpacingSquared;
      const hxy = phaseAt(coordinate.add(ivec3(1, 1, 0)))
        .sub(phaseAt(coordinate.add(ivec3(1, -1, 0))))
        .sub(phaseAt(coordinate.add(ivec3(-1, 1, 0))))
        .add(phaseAt(coordinate.add(ivec3(-1, -1, 0))))
        .mul(mixedScale);
      const hxz = phaseAt(coordinate.add(ivec3(1, 0, 1)))
        .sub(phaseAt(coordinate.add(ivec3(1, 0, -1))))
        .sub(phaseAt(coordinate.add(ivec3(-1, 0, 1))))
        .add(phaseAt(coordinate.add(ivec3(-1, 0, -1))))
        .mul(mixedScale);
      const hyz = phaseAt(coordinate.add(ivec3(0, 1, 1)))
        .sub(phaseAt(coordinate.add(ivec3(0, 1, -1))))
        .sub(phaseAt(coordinate.add(ivec3(0, -1, 1))))
        .add(phaseAt(coordinate.add(ivec3(0, -1, -1))))
        .mul(mixedScale);
      const worldHessian = [
        [hxx, hxy, hxz],
        [hxy, hyy, hyz],
        [hxz, hyz, hzz],
      ];
      const axes = [crystalAxisX, crystalAxisY, crystalAxisZ];
      const components = (vector: Vec3Node) => [vector.x, vector.y, vector.z];
      const crystalHessian = axes.map((left) =>
        axes.map((right) => {
          const leftComponents = components(left);
          const rightComponents = components(right);
          let value: FloatNode = float(0);
          for (let i = 0; i < 3; i += 1) {
            for (let j = 0; j < 3; j += 1) {
              value = value.add(
                leftComponents[i]!.mul(worldHessian[i]![j]!).mul(
                  rightComponents[j]!,
                ),
              );
            }
          }
          return value;
        }),
      );
      const gradientMagnitude = gradient.length();
      const crystalGradient = [
        gradient.dot(crystalAxisX),
        gradient.dot(crystalAxisY),
        gradient.dot(crystalAxisZ),
      ];
      const direction = crystalGradient.map((component) =>
        component.div(max(gradientMagnitude, 1e-12)),
      );
      const epsilon = parameters.anisotropyRegularization;
      const roots = direction.map((component) =>
        component.mul(component).add(epsilonSquared).sqrt(),
      );
      const a0 = roots[0]!
        .add(roots[1]!)
        .add(roots[2]!)
        .div(1 + epsilon);
      const first = roots.map((root, term) =>
        direction.map((component, axis) =>
          component.mul((term === axis ? 1 : 0) + epsilonSquared).div(root),
        ),
      );
      const second = roots.map((root, term) =>
        direction.map((_, i) =>
          direction.map((__, j) =>
            float(((term === i ? 1 : 0) + epsilonSquared) * (i === j ? 1 : 0))
              .sub(first[term]![i]!.mul(first[term]![j]!))
              .div(root),
          ),
        ),
      );
      let contraction: FloatNode = float(0);
      for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) {
          let firstI: FloatNode = float(0);
          let firstJ: FloatNode = float(0);
          let secondSum: FloatNode = float(0);
          for (let term = 0; term < 3; term += 1) {
            firstI = firstI.add(first[term]![i]!);
            firstJ = firstJ.add(first[term]![j]!);
            secondSum = secondSum.add(second[term]![i]![j]!);
          }
          const energyHessian = a0
            .mul(secondSum)
            .add(firstI.mul(firstJ))
            .div((1 + epsilon) * (1 + epsilon));
          contraction = contraction.add(
            crystalHessian[i]![j]!.mul(energyHessian),
          );
        }
      }
      const centered = contraction.div(3);
      const laplacian = hxx.add(hyy).add(hzz);
      return gradientMagnitude.greaterThan(1e-6).select(centered, laplacian);
    });

    const xFaceFluxAt = Fn(([coordinate]: [Ivec3Node]) => {
      const positiveX = coordinate.add(ivec3(1, 0, 0));
      const gradient = vec3(
        phaseAt(positiveX).sub(phaseAt(coordinate)).mul(inverseSpacing),
        phaseAt(coordinate.add(ivec3(0, 1, 0)))
          .sub(phaseAt(coordinate.sub(ivec3(0, 1, 0))))
          .add(
            phaseAt(positiveX.add(ivec3(0, 1, 0))).sub(
              phaseAt(positiveX.sub(ivec3(0, 1, 0))),
            ),
          )
          .mul(inverseFourSpacing),
        phaseAt(coordinate.add(ivec3(0, 0, 1)))
          .sub(phaseAt(coordinate.sub(ivec3(0, 0, 1))))
          .add(
            phaseAt(positiveX.add(ivec3(0, 0, 1))).sub(
              phaseAt(positiveX.sub(ivec3(0, 0, 1))),
            ),
          )
          .mul(inverseFourSpacing),
      );
      return anisotropyFluxForGradient(gradient);
    });

    const yFaceFluxAt = Fn(([coordinate]: [Ivec3Node]) => {
      const positiveY = coordinate.add(ivec3(0, 1, 0));
      const gradient = vec3(
        phaseAt(coordinate.add(ivec3(1, 0, 0)))
          .sub(phaseAt(coordinate.sub(ivec3(1, 0, 0))))
          .add(
            phaseAt(positiveY.add(ivec3(1, 0, 0))).sub(
              phaseAt(positiveY.sub(ivec3(1, 0, 0))),
            ),
          )
          .mul(inverseFourSpacing),
        phaseAt(positiveY).sub(phaseAt(coordinate)).mul(inverseSpacing),
        phaseAt(coordinate.add(ivec3(0, 0, 1)))
          .sub(phaseAt(coordinate.sub(ivec3(0, 0, 1))))
          .add(
            phaseAt(positiveY.add(ivec3(0, 0, 1))).sub(
              phaseAt(positiveY.sub(ivec3(0, 0, 1))),
            ),
          )
          .mul(inverseFourSpacing),
      );
      return anisotropyFluxForGradient(gradient);
    });

    const zFaceFluxAt = Fn(([coordinate]: [Ivec3Node]) => {
      const positiveZ = coordinate.add(ivec3(0, 0, 1));
      const gradient = vec3(
        phaseAt(coordinate.add(ivec3(1, 0, 0)))
          .sub(phaseAt(coordinate.sub(ivec3(1, 0, 0))))
          .add(
            phaseAt(positiveZ.add(ivec3(1, 0, 0))).sub(
              phaseAt(positiveZ.sub(ivec3(1, 0, 0))),
            ),
          )
          .mul(inverseFourSpacing),
        phaseAt(coordinate.add(ivec3(0, 1, 0)))
          .sub(phaseAt(coordinate.sub(ivec3(0, 1, 0))))
          .add(
            phaseAt(positiveZ.add(ivec3(0, 1, 0))).sub(
              phaseAt(positiveZ.sub(ivec3(0, 1, 0))),
            ),
          )
          .mul(inverseFourSpacing),
        phaseAt(positiveZ).sub(phaseAt(coordinate)).mul(inverseSpacing),
      );
      return anisotropyFluxForGradient(gradient);
    });

    const updatedPhaseAt = Fn(([coordinate]: [Ivec3Node]) => {
      const oldPhase = phaseAt(coordinate);
      const divergence =
        configuration.phaseOperator === 'author-centered'
          ? authorCenteredDivergenceAt(coordinate)
          : xFaceFluxAt(coordinate)
              .x.sub(xFaceFluxAt(coordinate.sub(ivec3(1, 0, 0))).x)
              .add(
                yFaceFluxAt(coordinate).y.sub(
                  yFaceFluxAt(coordinate.sub(ivec3(0, 1, 0))).y,
                ),
              )
              .add(
                zFaceFluxAt(coordinate).z.sub(
                  zFaceFluxAt(coordinate.sub(ivec3(0, 0, 1))).z,
                ),
              )
              .mul(inverseSpacing)
              .mul(configuration.surfaceEnergyNormalization);
      const oneMinusPhase = float(1).sub(oldPhase);
      const doubleWellDerivative = oldPhase
        .mul(oneMinusPhase)
        .mul(float(1).sub(oldPhase.mul(2)));
      const interpolationDerivative = oldPhase.mul(oneMinusPhase).mul(6);
      const bulkDriving = interpolationDerivative
        .mul(
          float(parameters.equilibriumChemicalPotential).sub(
            chemicalPotentialAt(coordinate),
          ),
        )
        .mul(configuration.deltaConcentration)
        .div(
          configuration.couplingLambda *
            parameters.interfaceWidth *
            parameters.interfaceWidth,
        );
      const phaseRate = divergence
        .sub(
          doubleWellDerivative.div(
            parameters.interfaceWidth * parameters.interfaceWidth,
          ),
        )
        .sub(bulkDriving);
      return oldPhase.add(phaseRate.mul(parameters.mobility).mul(timeStep));
    });

    return Fn(() => {
      const coordinate = voxelCoordinate();
      const nextPhase = updatedPhaseAt(coordinate).toVar();
      If(isBoundary(coordinate), () => {
        nextPhase.assign(updatedPhaseAt(nearestInteriorCoordinate(coordinate)));
      });

      writeScalar(targetPhase, coordinate, nextPhase);
    })().compute(voxelCount, [...SOLVER_WORKGROUP_SIZE]);
  };

  const createChemicalPotentialPass = (
    sourcePhase: Storage3DTexture,
    nextPhaseTexture: Storage3DTexture,
    sourceChemicalPotential: Storage3DTexture,
    targetChemicalPotential: Storage3DTexture,
  ): ComputeNode => {
    const oldPhaseAt = Fn(
      ([coordinate]: [Ivec3Node]) =>
        storageTexture3D(sourcePhase)
          .load(clampCoordinate(coordinate))
          .toReadOnly().r,
    );
    const nextPhaseAt = Fn(
      ([coordinate]: [Ivec3Node]) =>
        storageTexture3D(nextPhaseTexture)
          .load(clampCoordinate(coordinate))
          .toReadOnly().r,
    );
    const chemicalPotentialAt = Fn(
      ([coordinate]: [Ivec3Node]) =>
        storageTexture3D(sourceChemicalPotential)
          .load(clampCoordinate(coordinate))
          .toReadOnly().r,
    );
    const diffusivityAt = Fn(([coordinate]: [Ivec3Node]) => {
      const phase = nextPhaseAt(coordinate);
      return phase
        .mul(parameters.liquidDiffusivity)
        .add(float(1).sub(phase).mul(configuration.solidDiffusivity));
    });
    const faceFlux = Fn(([coordinate, offset]: [Ivec3Node, Ivec3Node]) => {
      const neighbor = coordinate.add(offset);
      const diffusivity = diffusivityAt(coordinate)
        .add(diffusivityAt(neighbor))
        .mul(0.5);
      return diffusivity.mul(
        chemicalPotentialAt(neighbor).sub(chemicalPotentialAt(coordinate)),
      );
    });

    const updatedChemicalPotentialAt = Fn(([coordinate]: [Ivec3Node]) => {
      const oldChemicalPotential = chemicalPotentialAt(coordinate);
      const diffusionDivergence = faceFlux(coordinate, ivec3(1, 0, 0))
        .add(faceFlux(coordinate, ivec3(-1, 0, 0)))
        .add(
          faceFlux(coordinate, ivec3(0, 1, 0)).add(
            faceFlux(coordinate, ivec3(0, -1, 0)),
          ),
        )
        .add(
          faceFlux(coordinate, ivec3(0, 0, 1)).add(
            faceFlux(coordinate, ivec3(0, 0, -1)),
          ),
        )
        .mul(inverseSpacingSquared);
      const oldPhase = oldPhaseAt(coordinate);
      const nextPhase = nextPhaseAt(coordinate);
      const oldInterpolation = oldPhase
        .mul(oldPhase)
        .mul(float(3).sub(oldPhase.mul(2)));
      const nextInterpolation = nextPhase
        .mul(nextPhase)
        .mul(float(3).sub(nextPhase.mul(2)));
      const diffusionIncrement = diffusionDivergence.mul(
        parameters.freeEnergyCurvature * timeStep,
      );
      const phaseChangeIncrement = nextInterpolation
        .sub(oldInterpolation)
        .mul(
          -parameters.freeEnergyCurvature * configuration.deltaConcentration,
        );
      return oldChemicalPotential
        .add(diffusionIncrement)
        .add(phaseChangeIncrement);
    });

    return Fn(() => {
      const coordinate = voxelCoordinate();
      const position = positionAt(coordinate);
      const oldChemicalPotential = chemicalPotentialAt(coordinate);
      const nextChemicalPotential = oldChemicalPotential.toVar();

      If(isFarBoundary(coordinate), () => {
        nextChemicalPotential.assign(farFieldAtNode(position));
      })
        .ElseIf(isSymmetryBoundary(coordinate), () => {
          nextChemicalPotential.assign(
            updatedChemicalPotentialAt(nearestInteriorCoordinate(coordinate)),
          );
        })
        .Else(() => {
          nextChemicalPotential.assign(updatedChemicalPotentialAt(coordinate));
        });

      writeScalar(targetChemicalPotential, coordinate, nextChemicalPotential);
    })().compute(voxelCount, [...SOLVER_WORKGROUP_SIZE]);
  };

  const createSolidificationTimePass = (
    sourceSolidificationTime: Storage3DTexture,
    sourcePhaseTexture: Storage3DTexture,
    nextPhaseTexture: Storage3DTexture,
    targetSolidificationTime: Storage3DTexture,
    nextTime: FloatNode,
  ): ComputeNode => {
    const recordedAt = Fn(
      ([coordinate]: [Ivec3Node]) =>
        storageTexture3D(sourceSolidificationTime)
          .load(clampCoordinate(coordinate))
          .toReadOnly().r,
    );
    const sourcePhaseAt = Fn(
      ([coordinate]: [Ivec3Node]) =>
        storageTexture3D(sourcePhaseTexture)
          .load(clampCoordinate(coordinate))
          .toReadOnly().r,
    );
    const nextPhaseAt = Fn(
      ([coordinate]: [Ivec3Node]) =>
        storageTexture3D(nextPhaseTexture)
          .load(clampCoordinate(coordinate))
          .toReadOnly().r,
    );

    const updatedRecordedAt = Fn(([coordinate]: [Ivec3Node]) => {
      const recorded = recordedAt(coordinate);
      const nextRecorded = recorded.toVar();
      If(
        recorded
          .lessThan(0)
          .and(
            sourcePhaseAt(coordinate).greaterThan(
              configuration.grid.solidificationThreshold,
            ),
          )
          .and(
            nextPhaseAt(coordinate).lessThanEqual(
              configuration.grid.solidificationThreshold,
            ),
          ),
        () => {
          nextRecorded.assign(nextTime);
        },
      );
      return nextRecorded;
    });

    return Fn(() => {
      const coordinate = voxelCoordinate();
      const nextRecorded = updatedRecordedAt(coordinate).toVar();

      If(isFarBoundary(coordinate), () => {
        nextRecorded.assign(-1);
      }).ElseIf(isSymmetryBoundary(coordinate), () => {
        nextRecorded.assign(
          updatedRecordedAt(nearestInteriorCoordinate(coordinate)),
        );
      });

      writeScalar(targetSolidificationTime, coordinate, nextRecorded);
    })().compute(voxelCount, [...SOLVER_WORKGROUP_SIZE]);
  };

  const phaseAToB = createPhasePass(phaseA, chemicalPotentialA, phaseB);
  const phaseBToA = createPhasePass(phaseB, chemicalPotentialB, phaseA);
  const chemicalPotentialAToB = createChemicalPotentialPass(
    phaseA,
    phaseB,
    chemicalPotentialA,
    chemicalPotentialB,
  );
  const chemicalPotentialBToA = createChemicalPotentialPass(
    phaseB,
    phaseA,
    chemicalPotentialB,
    chemicalPotentialA,
  );

  const solidificationTimeValue = uniform(timeStep);
  const solidificationTimeAToB = createSolidificationTimePass(
    solidificationTimeA,
    phaseA,
    phaseB,
    solidificationTimeB,
    solidificationTimeValue,
  );
  const solidificationTimeBToA = createSolidificationTimePass(
    solidificationTimeB,
    phaseB,
    phaseA,
    solidificationTimeA,
    solidificationTimeValue,
  );

  return {
    phaseA,
    phaseB,
    chemicalPotentialA,
    chemicalPotentialB,
    solidificationTimeA,
    solidificationTimeB,
    initializeA,
    phaseAToB,
    phaseBToA,
    chemicalPotentialAToB,
    chemicalPotentialBToA,
    solidificationTimeAToB,
    solidificationTimeBToA,
    solidificationTimeValue,
    dispose() {
      initializeA.dispose();
      phaseAToB.dispose();
      phaseBToA.dispose();
      chemicalPotentialAToB.dispose();
      chemicalPotentialBToA.dispose();
      solidificationTimeAToB.dispose();
      solidificationTimeBToA.dispose();
      phaseA.dispose();
      phaseB.dispose();
      chemicalPotentialA.dispose();
      chemicalPotentialB.dispose();
      solidificationTimeA.dispose();
      solidificationTimeB.dispose();
    },
  };
}

export function createGpuSingleCrystalSolver(
  renderer: WebGPURenderer,
  device: GPUDevice,
  configuration: SimulationConfiguration | DerivedSimulationConfiguration,
): GpuSingleCrystalSolver {
  const derived =
    'couplingLambda' in configuration
      ? configuration
      : deriveSimulationConfiguration(configuration);
  const resources = createSolverResources(derived);
  let isInitialized = false;
  let isDisposed = false;
  let activeA = true;
  let currentStep = 0;
  let currentTime = 0;

  const assertUsable = () => {
    if (isDisposed) {
      throw new Error('The GPU single-crystal solver has been disposed.');
    }
  };

  const textures = (): GpuSolverTextures =>
    activeA
      ? {
          phase: resources.phaseA,
          chemicalPotential: resources.chemicalPotentialA,
          solidificationTime: resources.solidificationTimeA,
        }
      : {
          phase: resources.phaseB,
          chemicalPotential: resources.chemicalPotentialB,
          solidificationTime: resources.solidificationTimeB,
        };
  const textureParities: readonly [GpuSolverTextures, GpuSolverTextures] = [
    {
      phase: resources.phaseA,
      chemicalPotential: resources.chemicalPotentialA,
      solidificationTime: resources.solidificationTimeA,
    },
    {
      phase: resources.phaseB,
      chemicalPotential: resources.chemicalPotentialB,
      solidificationTime: resources.solidificationTimeB,
    },
  ];

  return {
    configuration: derived,
    get initialized() {
      return isInitialized;
    },
    get simulatedTime() {
      return currentTime;
    },
    get stepCount() {
      return currentStep;
    },
    get currentTextures() {
      return textures();
    },
    get currentTextureParity() {
      return activeA ? 0 : 1;
    },
    textureParities,
    async initialize() {
      assertUsable();
      if (isInitialized) {
        return;
      }

      await renderer.computeAsync(resources.initializeA);
      await device.queue.onSubmittedWorkDone();
      isInitialized = true;
    },
    async step(steps = 1) {
      assertUsable();
      if (!isInitialized) {
        throw new Error('Initialize the GPU solver before stepping it.');
      }
      if (!Number.isInteger(steps) || steps < 1) {
        throw new Error('GPU solver step count must be a positive integer.');
      }

      for (let index = 0; index < steps; index += 1) {
        await renderer.computeAsync(
          activeA ? resources.phaseAToB : resources.phaseBToA,
        );

        await renderer.computeAsync(
          activeA
            ? resources.chemicalPotentialAToB
            : resources.chemicalPotentialBToA,
        );

        resources.solidificationTimeValue.value =
          (currentStep + 1) * derived.grid.timeStep;
        await renderer.computeAsync(
          activeA
            ? resources.solidificationTimeAToB
            : resources.solidificationTimeBToA,
        );

        activeA = !activeA;
        currentStep += 1;
        currentTime = currentStep * derived.grid.timeStep;
      }

      await device.queue.onSubmittedWorkDone();
    },
    dispose() {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      resources.dispose();
    },
  };
}
