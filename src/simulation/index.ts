/** Typed boundary for the phase-field solver introduced after milestone 0A. */
export interface SimulationSubsystem {
  readonly kind: 'simulation';
}

export * from './config';
export * from './cpu-reference';
export * from './metrics';
export * from './model';
export * from './random';
