import { describe, expect, it } from 'vitest';
import { generateCrystal } from './generateCrystal';
import { baseGenerationSettings } from './testSettings';

describe('generateCrystal timeline events', () => {
  it('emits deterministic, monotonic progress and display timing', () => {
    const { events } = generateCrystal(baseGenerationSettings);

    expect(events[0].step).toBe('seed');
    expect(events.at(-1)?.step).toBe('complete');
    expect(events.at(-1)?.progress).toBe(1);

    for (let index = 1; index < events.length; index += 1) {
      expect(events[index].progress).toBeGreaterThanOrEqual(events[index - 1].progress);
      expect(events[index].displayTimeMs).toBeGreaterThanOrEqual(
        events[index - 1].displayTimeMs ?? 0,
      );
    }
  });
});
