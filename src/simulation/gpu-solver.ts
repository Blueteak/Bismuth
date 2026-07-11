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
  farFieldChemicalPotentialAt,
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

export interface GpuFieldState {
  readonly phase: Float32Array;
  readonly chemicalPotential: Float32Array;
  readonly solidificationTime: Float32Array;
  readonly simulatedTime: number;
  readonly stepCount: number;
}

export interface SolverStepTimings {
  readonly steps: number;
  /** CPU-side async submission overhead; these are not GPU timestamp queries. */
  readonly phaseMilliseconds: number;
  readonly chemicalPotentialMilliseconds: number;
  readonly solidificationTimeMilliseconds: number;
  /** Wall time through the final queue completion for the whole step batch. */
  readonly totalMilliseconds: number;
}

export interface GpuSingleCrystalSolver {
  readonly configuration: DerivedSimulationConfiguration;
  readonly initialized: boolean;
  readonly simulatedTime: number;
  readonly stepCount: number;
  readonly currentTextures: GpuSolverTextures;
  initialize(): Promise<void>;
  step(steps?: number): Promise<SolverStepTimings>;
  readFields(): Promise<GpuFieldState>;
  dispose(): void;
}

interface TextureReadbackBackend {
  copyTextureToBuffer(
    texture: Storage3DTexture,
    x: number,
    y: number,
    width: number,
    height: number,
    depthSlice: number,
  ): Promise<ArrayBufferView>;
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
      .sub(vec3((width - 1) / 2, (height - 1) / 2, (depth - 1) / 2))
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
    const boundary = isBoundary(coordinate);
    const phasePosition = positionAt(nearestInteriorCoordinate(coordinate));
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
    const farField = farFieldAtNode(position);
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

    If(boundary, () => {
      chemicalPotential.assign(farField);
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
      const gradientSquared = crystalGradient.dot(crystalGradient);
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
      const derivative = vec3(
        crystalGradient.x
          .div(max(qx, minimumAnisotropyDenominator))
          .add(crystalGradient.x.mul(epsilonSquared).mul(inverseSum)),
        crystalGradient.y
          .div(max(qy, minimumAnisotropyDenominator))
          .add(crystalGradient.y.mul(epsilonSquared).mul(inverseSum)),
        crystalGradient.z
          .div(max(qz, minimumAnisotropyDenominator))
          .add(crystalGradient.z.mul(epsilonSquared).mul(inverseSum)),
      ).mul(qx.add(qy).add(qz));

      return crystalAxisX
        .mul(derivative.x)
        .add(crystalAxisY.mul(derivative.y))
        .add(crystalAxisZ.mul(derivative.z));
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
      const divergence = xFaceFluxAt(coordinate)
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
        .sub(bulkDriving)
        .mul(parameters.mobility);
      return oldPhase.add(phaseRate.mul(timeStep));
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

    return Fn(() => {
      const coordinate = voxelCoordinate();
      const position = positionAt(coordinate);
      const oldChemicalPotential = chemicalPotentialAt(coordinate);
      const nextChemicalPotential = oldChemicalPotential.toVar();

      If(isBoundary(coordinate), () => {
        nextChemicalPotential.assign(farFieldAtNode(position));
      }).Else(() => {
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
        nextChemicalPotential.assign(
          oldChemicalPotential
            .add(diffusionIncrement)
            .add(phaseChangeIncrement),
        );
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

    return Fn(() => {
      const coordinate = voxelCoordinate();
      const recorded = recordedAt(coordinate);
      const nextRecorded = recorded.toVar();

      If(isBoundary(coordinate), () => {
        nextRecorded.assign(-1);
      }).ElseIf(
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

async function readScalarTexture(
  renderer: WebGPURenderer,
  texture: Storage3DTexture,
  shape: readonly [number, number, number],
): Promise<Float32Array> {
  const backend = renderer.backend as unknown as TextureReadbackBackend;
  const [width, height, depth] = shape;
  const values = new Float32Array(width * height * depth);
  const bytesPerRow =
    Math.ceil((width * Float32Array.BYTES_PER_ELEMENT) / 256) * 256;
  const floatsPerAlignedRow = bytesPerRow / Float32Array.BYTES_PER_ELEMENT;

  for (let z = 0; z < depth; z += 1) {
    const view = await backend.copyTextureToBuffer(
      texture,
      0,
      0,
      width,
      height,
      z,
    );
    const layer = new Float32Array(
      view.buffer,
      view.byteOffset,
      view.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        values[x + width * (y + height * z)] =
          layer[y * floatsPerAlignedRow + x] ?? Number.NaN;
      }
    }
  }

  return values;
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

      let phaseMilliseconds = 0;
      let chemicalPotentialMilliseconds = 0;
      let solidificationTimeMilliseconds = 0;
      const totalStartedAt = performance.now();

      for (let index = 0; index < steps; index += 1) {
        const phaseStartedAt = performance.now();
        await renderer.computeAsync(
          activeA ? resources.phaseAToB : resources.phaseBToA,
        );
        phaseMilliseconds += performance.now() - phaseStartedAt;

        const chemicalPotentialStartedAt = performance.now();
        await renderer.computeAsync(
          activeA
            ? resources.chemicalPotentialAToB
            : resources.chemicalPotentialBToA,
        );
        chemicalPotentialMilliseconds +=
          performance.now() - chemicalPotentialStartedAt;

        const solidificationTimeStartedAt = performance.now();
        resources.solidificationTimeValue.value =
          (currentStep + 1) * derived.grid.timeStep;
        await renderer.computeAsync(
          activeA
            ? resources.solidificationTimeAToB
            : resources.solidificationTimeBToA,
        );
        solidificationTimeMilliseconds +=
          performance.now() - solidificationTimeStartedAt;

        activeA = !activeA;
        currentStep += 1;
        currentTime = currentStep * derived.grid.timeStep;
      }

      await device.queue.onSubmittedWorkDone();
      return {
        steps,
        phaseMilliseconds,
        chemicalPotentialMilliseconds,
        solidificationTimeMilliseconds,
        totalMilliseconds: performance.now() - totalStartedAt,
      };
    },
    async readFields() {
      assertUsable();
      if (!isInitialized) {
        throw new Error('Initialize the GPU solver before reading fields.');
      }

      await device.queue.onSubmittedWorkDone();
      const current = textures();
      const [phase, chemicalPotential, solidificationTime] = await Promise.all([
        readScalarTexture(renderer, current.phase, derived.grid.shape),
        readScalarTexture(
          renderer,
          current.chemicalPotential,
          derived.grid.shape,
        ),
        readScalarTexture(
          renderer,
          current.solidificationTime,
          derived.grid.shape,
        ),
      ]);

      return {
        phase,
        chemicalPotential,
        solidificationTime,
        simulatedTime: currentTime,
        stepCount: currentStep,
      };
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

export function describeFarBoundary(
  configuration: DerivedSimulationConfiguration,
): readonly [number, number] {
  const [width, height, depth] = configuration.grid.shape;
  const spacing = configuration.grid.spacing;
  const minimum: Vec3 = [
    -((width - 1) * spacing) / 2,
    -((height - 1) * spacing) / 2,
    -((depth - 1) * spacing) / 2,
  ];
  const maximum: Vec3 = minimum.map((value) => -value) as unknown as Vec3;
  return [
    farFieldChemicalPotentialAt(configuration, minimum),
    farFieldChemicalPotentialAt(configuration, maximum),
  ];
}
