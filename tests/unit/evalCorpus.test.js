import { describe, expect, it } from 'vitest';
import {
  corpusSummary,
  promptCases,
  revisionCases,
  validatorCases,
} from '../../evals/corpus.mjs';

describe('product evaluation corpus', () => {
  it('contains at least 300 project-authored evaluation items', () => {
    expect(corpusSummary.total).toBeGreaterThanOrEqual(300);
    expect(corpusSummary.provenance).toContain('not teacher calibrated');
  });

  it('covers all nine routing topics and five question types', () => {
    expect(new Set(promptCases.map((item) => item.topic)).size).toBe(9);
    expect(promptCases).toHaveLength(180);
  });

  it('contains semantic adversaries and revision-transfer triads', () => {
    expect(validatorCases.some((item) => item.category === 'absurd-causality')).toBe(true);
    expect(validatorCases.some((item) => item.category === 'unsupported-attribution')).toBe(true);
    expect(revisionCases).toHaveLength(54);
    expect(revisionCases.every((item) => item.transferPrompt)).toBe(true);
  });
});

