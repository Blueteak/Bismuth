import type { DerivedSimulationConfiguration, Vec3 } from './config';

/** Omega(phi) from Bollada, Jimack, and Mullis (2023), Eq. 2. */
export function doubleWell(phi: number): number {
  return 0.5 * phi * phi * (1 - phi) * (1 - phi);
}

/** dOmega/dphi = phi (1 - phi) (1 - 2 phi). */
export function doubleWellDerivative(phi: number): number {
  return phi * (1 - phi) * (1 - 2 * phi);
}

/** g(phi) from Eq. 2. */
export function interpolation(phi: number): number {
  return 3 * phi * phi - 2 * phi * phi * phi;
}

/** dg/dphi = 6 phi (1 - phi). */
export function interpolationDerivative(phi: number): number {
  return 6 * phi * (1 - phi);
}

/** D(phi) = phi D_L + (1 - phi) D_S from Eq. 3. */
export function phaseDiffusivity(
  phi: number,
  config: DerivedSimulationConfiguration,
): number {
  return (
    phi * config.parameters.liquidDiffusivity +
    (1 - phi) * config.solidDiffusivity
  );
}

function dot(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function crystalGradient(
  gradient: Vec3,
  axes: readonly [Vec3, Vec3, Vec3],
): Vec3 {
  return [
    dot(gradient, axes[0]),
    dot(gradient, axes[1]),
    dot(gradient, axes[2]),
  ];
}

/** A = sum_i sqrt(X_i^2 + epsilon^2 |grad(phi)|^2), paper Eq. 8. */
export function anisotropyMagnitude(
  gradient: Vec3,
  axes: readonly [Vec3, Vec3, Vec3],
  epsilon: number,
): number {
  const components = crystalGradient(gradient, axes);
  const squaredMagnitude = dot(components, components);
  const epsilonSquared = epsilon * epsilon;

  return (
    Math.sqrt(components[0] ** 2 + epsilonSquared * squaredMagnitude) +
    Math.sqrt(components[1] ** 2 + epsilonSquared * squaredMagnitude) +
    Math.sqrt(components[2] ** 2 + epsilonSquared * squaredMagnitude)
  );
}

/**
 * World-space derivative of A^2 / 2 with respect to grad(phi), as required
 * by Eq. 1. Crystal orientation rotates the gradient into the crystal frame
 * and the resulting derivative back into the world frame.
 */
export function anisotropyFlux(
  gradient: Vec3,
  axes: readonly [Vec3, Vec3, Vec3],
  epsilon: number,
): Vec3 {
  const components = crystalGradient(gradient, axes);
  const squaredMagnitude = dot(components, components);
  if (squaredMagnitude === 0) {
    return [0, 0, 0];
  }

  const epsilonSquared = epsilon * epsilon;
  const roots: Vec3 = [
    Math.sqrt(components[0] ** 2 + epsilonSquared * squaredMagnitude),
    Math.sqrt(components[1] ** 2 + epsilonSquared * squaredMagnitude),
    Math.sqrt(components[2] ** 2 + epsilonSquared * squaredMagnitude),
  ];
  const magnitude = roots[0] + roots[1] + roots[2];
  const reciprocalRootSum = 1 / roots[0] + 1 / roots[1] + 1 / roots[2];
  const crystalFlux: Vec3 = [
    magnitude *
      components[0] *
      (1 / roots[0] + epsilonSquared * reciprocalRootSum),
    magnitude *
      components[1] *
      (1 / roots[1] + epsilonSquared * reciprocalRootSum),
    magnitude *
      components[2] *
      (1 / roots[2] + epsilonSquared * reciprocalRootSum),
  ];

  return [
    axes[0][0] * crystalFlux[0] +
      axes[1][0] * crystalFlux[1] +
      axes[2][0] * crystalFlux[2],
    axes[0][1] * crystalFlux[0] +
      axes[1][1] * crystalFlux[1] +
      axes[2][1] * crystalFlux[2],
    axes[0][2] * crystalFlux[0] +
      axes[1][2] * crystalFlux[1] +
      axes[2][2] * crystalFlux[2],
  ];
}

/** Explicit phase rate from paper Eq. 1 after anisotropy divergence is known. */
export function phaseLocalRate(
  phi: number,
  chemicalPotential: number,
  anisotropyDivergence: number,
  config: DerivedSimulationConfiguration,
): number {
  const { parameters, couplingLambda, deltaConcentration } = config;
  const interfaceWidthSquared = parameters.interfaceWidth ** 2;
  const bulkRate = doubleWellDerivative(phi) / interfaceWidthSquared;
  const chemicalDrivingRate =
    (interpolationDerivative(phi) *
      (parameters.equilibriumChemicalPotential - chemicalPotential) *
      deltaConcentration) /
    (couplingLambda * interfaceWidthSquared);

  return (
    parameters.mobility *
    (anisotropyDivergence - bulkRate - chemicalDrivingRate)
  );
}

/** Non-diffusive chemical-potential source in paper Eq. 3. */
export function chemicalSourceRate(
  phi: number,
  phaseRate: number,
  config: DerivedSimulationConfiguration,
): number {
  return (
    -config.parameters.freeEnergyCurvature *
    config.deltaConcentration *
    interpolationDerivative(phi) *
    phaseRate
  );
}

/**
 * Discrete counterpart of -a DeltaC g'(phi) phiDot integrated over one
 * phase step. Using Delta g exactly preserves the phase-change contribution
 * to the model's implied concentration under operator splitting.
 */
export function chemicalSourceIncrement(
  oldPhi: number,
  nextPhi: number,
  config: DerivedSimulationConfiguration,
): number {
  return (
    -config.parameters.freeEnergyCurvature *
    config.deltaConcentration *
    (interpolation(nextPhi) - interpolation(oldPhi))
  );
}
