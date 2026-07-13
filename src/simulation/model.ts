import type { DerivedSimulationConfiguration } from './config';
export { anisotropyFlux, anisotropyMagnitude } from './anisotropy';

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
