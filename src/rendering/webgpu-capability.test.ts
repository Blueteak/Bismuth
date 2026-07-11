import { describe, expect, it } from 'vitest';
import {
  verifyWebGpuBackend,
  WebGpuCapabilityError,
} from './webgpu-capability';

describe('verifyWebGpuBackend', () => {
  it('accepts only the Three.js WebGPU backend', () => {
    expect(() =>
      verifyWebGpuBackend({ backend: { isWebGPUBackend: true } }),
    ).not.toThrow();
  });

  it('rejects a fallback backend explicitly', () => {
    expect(() =>
      verifyWebGpuBackend({ backend: { isWebGLBackend: true } }),
    ).toThrow(WebGpuCapabilityError);
  });
});
