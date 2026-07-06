import { CanvasTexture, RepeatWrapping } from 'three';

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function hashFloat(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;

  return value - Math.floor(value);
}

export function createSurfaceDetailTexture(strength: number) {
  const normalizedStrength = clamp01(strength);
  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  const base = Math.round(132 + normalizedStrength * 22);
  context.fillStyle = `rgb(${base}, ${base}, ${base})`;
  context.fillRect(0, 0, size, size);

  const scratchCount = Math.round(24 + normalizedStrength * 150);
  context.lineCap = 'round';

  for (let index = 0; index < scratchCount; index += 1) {
    const x = hashFloat(index + normalizedStrength * 101) * size;
    const y = hashFloat(index + normalizedStrength * 211) * size;
    const length = 6 + hashFloat(index + 17) * (18 + normalizedStrength * 28);
    const angle = (hashFloat(index + 31) - 0.5) * 0.7;
    const value = Math.round(104 + hashFloat(index + 47) * 92);

    context.strokeStyle = `rgba(${value}, ${value}, ${value}, ${0.18 + normalizedStrength * 0.34})`;
    context.lineWidth = 0.5 + hashFloat(index + 59) * (0.8 + normalizedStrength);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.needsUpdate = true;

  return texture;
}
