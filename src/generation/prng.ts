export interface SeededPrng {
  next: () => number;
  nextInt: (min: number, max: number) => number;
  signed: (magnitude?: number) => number;
  pickSign: () => -1 | 1;
}

function cyrb128(value: string) {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let index = 0; index < value.length; index += 1) {
    const char = value.charCodeAt(index);
    h1 = h2 ^ Math.imul(h1 ^ char, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ char, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ char, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ char, 2716044179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ] as const;
}

function sfc32(a: number, b: number, c: number, d: number) {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;

    const t = (a + b + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;

    return (t >>> 0) / 4294967296;
  };
}

export function createSeededPrng(seed: string): SeededPrng {
  const [a, b, c, d] = cyrb128(seed);
  const next = sfc32(a, b, c, d);

  return {
    next,
    nextInt: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    signed: (magnitude = 1) => (next() * 2 - 1) * magnitude,
    pickSign: () => (next() < 0.5 ? -1 : 1),
  };
}

export function hashString(value: string) {
  const [a, b, c, d] = cyrb128(value);
  return [a, b, c, d]
    .map((part) => part.toString(16).padStart(8, '0'))
    .join('');
}
