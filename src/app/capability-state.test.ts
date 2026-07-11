import { describe, expect, it } from 'vitest';
import { resolveCapabilityState } from './capability-state';

describe('resolveCapabilityState', () => {
  it('keeps the shell loading when no validated capability result exists', () => {
    expect(resolveCapabilityState(undefined)).toEqual({ status: 'loading' });
    expect(resolveCapabilityState({ status: 'supported' })).toEqual({
      status: 'loading',
    });
  });

  it('accepts a complete injected unsupported result', () => {
    expect(
      resolveCapabilityState({
        status: 'unsupported',
        reason: 'A hardware WebGPU adapter is unavailable.',
      }),
    ).toEqual({
      status: 'unsupported',
      reason: 'A hardware WebGPU adapter is unavailable.',
    });
  });
});
