import { describe, expect, it } from 'vitest';
import {
  corpusSummary,
  matrixCases,
  promptCases,
  revisionCases,
  validatorCases,
  wizardCases,
} from '../../evals/corpus.mjs';
import {
  EVAL_THRESHOLDS,
  computeEvalMetrics,
  thresholdsMet,
} from '../../evals/metrics.mjs';

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

  it('covers the matrix and wizard contract gates', () => {
    expect(matrixCases.length).toBeGreaterThanOrEqual(6);
    expect(matrixCases.some((item) => item.category === 'missing-section')).toBe(true);
    expect(matrixCases.some((item) => item.category === 'off-topic')).toBe(true);
    expect(wizardCases.some((item) => item.stage === 'questions')).toBe(true);
    expect(wizardCases.some((item) => item.stage === 'scripts')).toBe(true);
  });
});

describe('evaluation regression gate', () => {
  // These thresholds are the product's quality contract. If a change pushes
  // any metric past its bound, this test fails and the run-evals report
  // (scripts/run-evals.mjs) exits non-zero as well. The corpus is ~320 items
  // with parse+validate per item, so allow a generous timeout.
  it(
    'meets all quality thresholds over the corpus',
    () => {
      const metrics = computeEvalMetrics({
        promptCases,
        validatorCases,
        revisionCases,
        matrixCases,
        wizardCases,
      });
      expect(thresholdsMet(metrics)).toBe(true);
      expect(metrics.topicMacroF1).toBeGreaterThanOrEqual(EVAL_THRESHOLDS.topicMacroF1);
      expect(metrics.semanticFalseAcceptRate).toBeLessThanOrEqual(
        EVAL_THRESHOLDS.semanticFalseAcceptRate
      );
      expect(metrics.revisionTargetResolutionRate).toBeGreaterThanOrEqual(
        EVAL_THRESHOLDS.revisionTargetResolutionRate
      );
      expect(metrics.matrixContractAccuracy).toBeGreaterThanOrEqual(
        EVAL_THRESHOLDS.matrixContractAccuracy
      );
      expect(metrics.wizardContractAccuracy).toBeGreaterThanOrEqual(
        EVAL_THRESHOLDS.wizardContractAccuracy
      );
    },
    20_000
  );
});


