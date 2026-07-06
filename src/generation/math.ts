export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function dotVector(a: readonly number[], b: readonly number[]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function crossVector(a: readonly number[], b: readonly number[]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function addVectors(
  first: readonly number[],
  second: readonly number[],
): [number, number, number] {
  return [
    first[0] + second[0],
    first[1] + second[1],
    first[2] + second[2],
  ];
}

export function scaleVector(
  vector: readonly number[],
  scale: number,
): [number, number, number] {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale];
}

export function normalizeVector(vector: readonly number[]): [number, number, number] {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length < 0.0001) {
    return [0, 1, 0];
  }

  return [
    Number((vector[0] / length).toFixed(4)),
    Number((vector[1] / length).toFixed(4)),
    Number((vector[2] / length).toFixed(4)),
  ];
}

export function roundedVector(vector: readonly number[]): [number, number, number] {
  return vector.map((value) => Number(value.toFixed(4))) as [number, number, number];
}

export function getMisorientation(
  first: [number, number, number],
  second: [number, number, number],
) {
  return clamp01((1 - dotVector(first, second)) * 0.5);
}

export function rotateCell(x: number, z: number, orientation: 0 | 1 | 2 | 3) {
  if (orientation === 1) {
    return [-z, x] as const;
  }
  if (orientation === 2) {
    return [-x, -z] as const;
  }
  if (orientation === 3) {
    return [z, -x] as const;
  }

  return [x, z] as const;
}

export function transformLocalPoint(
  origin: readonly number[],
  basis: {
    right: [number, number, number];
    up: [number, number, number];
    forward: [number, number, number];
  },
  local: readonly number[],
) {
  return roundedVector([
    origin[0] + basis.right[0] * local[0] + basis.up[0] * local[1] + basis.forward[0] * local[2],
    origin[1] + basis.right[1] * local[0] + basis.up[1] * local[1] + basis.forward[1] * local[2],
    origin[2] + basis.right[2] * local[0] + basis.up[2] * local[1] + basis.forward[2] * local[2],
  ]);
}

export function transformLocalDirection(
  basis: {
    right: [number, number, number];
    up: [number, number, number];
    forward: [number, number, number];
  },
  local: readonly number[],
) {
  return normalizeVector([
    basis.right[0] * local[0] + basis.up[0] * local[1] + basis.forward[0] * local[2],
    basis.right[1] * local[0] + basis.up[1] * local[1] + basis.forward[1] * local[2],
    basis.right[2] * local[0] + basis.up[2] * local[1] + basis.forward[2] * local[2],
  ]);
}
