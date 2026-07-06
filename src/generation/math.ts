export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function dotVector(a: readonly number[], b: readonly number[]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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

