export type AnisotropyVector = readonly [number, number, number];

export type AnisotropyGenerators = readonly [
  AnisotropyVector,
  AnisotropyVector,
  AnisotropyVector,
];

function dot(left: AnisotropyVector, right: AnisotropyVector): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

/**
 * Regularized faceted surface energy used by the conservative phase operator.
 * The generators may be non-orthogonal; |grad(phi)| remains a world-space
 * magnitude rather than a sum of generator projections.
 */
export function anisotropyMagnitude(
  gradient: AnisotropyVector,
  generators: AnisotropyGenerators,
  epsilon: number,
): number {
  const squaredMagnitude = dot(gradient, gradient);
  const epsilonSquared = epsilon * epsilon;
  return generators.reduce((sum, generator) => {
    const projection = dot(gradient, generator);
    return (
      sum +
      Math.sqrt(projection * projection + epsilonSquared * squaredMagnitude)
    );
  }, 0);
}

/** World-space derivative of A^2 / 2 with respect to grad(phi). */
export function anisotropyFlux(
  gradient: AnisotropyVector,
  generators: AnisotropyGenerators,
  epsilon: number,
): AnisotropyVector {
  const squaredMagnitude = dot(gradient, gradient);
  if (squaredMagnitude === 0) return [0, 0, 0];

  const epsilonSquared = epsilon * epsilon;
  const projections = generators.map((generator) => dot(gradient, generator));
  const roots = projections.map((projection) =>
    Math.sqrt(projection * projection + epsilonSquared * squaredMagnitude),
  );
  const magnitude = roots.reduce((sum, root) => sum + root, 0);
  const reciprocalRootSum = roots.reduce((sum, root) => sum + 1 / root, 0);
  const derivative = [0, 0, 0];

  for (let term = 0; term < 3; term += 1) {
    const generator = generators[term]!;
    const projection = projections[term] ?? 0;
    const inverseRoot = 1 / (roots[term] ?? 1);
    for (let axis = 0; axis < 3; axis += 1) {
      derivative[axis] =
        (derivative[axis] ?? 0) +
        projection * (generator[axis] ?? 0) * inverseRoot;
    }
  }
  for (let axis = 0; axis < 3; axis += 1) {
    derivative[axis] =
      (derivative[axis] ?? 0) +
      epsilonSquared * (gradient[axis] ?? 0) * reciprocalRootSum;
  }

  return [
    magnitude * (derivative[0] ?? 0),
    magnitude * (derivative[1] ?? 0),
    magnitude * (derivative[2] ?? 0),
  ];
}
