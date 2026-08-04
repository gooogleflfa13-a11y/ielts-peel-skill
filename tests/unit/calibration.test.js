import { describe, expect, it } from 'vitest';
import {
  sampleBatch,
} from '../../evals/calibration/sample.mjs';
import {
  buildCalibrationReport,
  cohensKappa,
  majorityConsensus,
  validateAnnotation,
} from '../../evals/calibration/annotations.mjs';

describe('calibration - batch sampling', () => {
  it('never leaks the synthetic expected label', () => {
    const batch = sampleBatch({ seed: 3 });
    expect(batch.length).toBeGreaterThan(0);
    for (const entry of batch) {
      expect(entry).not.toHaveProperty('expectedPass');
      expect(entry).not.toHaveProperty('expected');
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('response');
    }
  });

  it('is reproducible for a given seed and covers all three sets', () => {
    const a = sampleBatch({ perCategory: 1, seed: 7 });
    const b = sampleBatch({ perCategory: 1, seed: 7 });
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
    const sets = new Set(a.map((e) => e.set));
    expect(sets).toEqual(new Set(['validator', 'matrix', 'wizard']));
  });

  it('respects the per-category cap', () => {
    const batch = sampleBatch({ perCategory: 1, seed: 1 });
    const byCategory = new Map();
    for (const entry of batch) {
      const key = `${entry.set}/${entry.category}`;
      byCategory.set(key, (byCategory.get(key) || 0) + 1);
    }
    for (const count of byCategory.values()) expect(count).toBeLessThanOrEqual(1);
  });
});

describe('calibration - annotation validation', () => {
  it('accepts a valid annotation and rejects malformed ones', () => {
    const valid = { id: 'validator_education_valid', rater: 't1', pass: true };
    expect(validateAnnotation(valid).ok).toBe(true);

    expect(validateAnnotation({ id: 'ghost_id', rater: 't1', pass: true }).ok).toBe(false);
    expect(validateAnnotation({ id: 'validator_education_valid', rater: '', pass: true }).ok).toBe(false);
    expect(validateAnnotation({ id: 'validator_education_valid', rater: 't1', pass: 'yes' }).ok).toBe(false);
    expect(validateAnnotation({ id: 'validator_education_valid', rater: 't1', pass: null }).ok).toBe(true);
  });
});

describe('calibration - inter-rater reliability', () => {
  const byRater = (maps) => new Map(Object.entries(maps));

  it('returns kappa 1 for identical definite labels', () => {
    const maps = byRater({
      a: new Map([
        ['x', { pass: true }],
        ['y', { pass: false }],
      ]),
      b: new Map([
        ['x', { pass: true }],
        ['y', { pass: false }],
      ]),
    });
    const { kappa, n } = cohensKappa('a', 'b', maps);
    expect(n).toBe(2);
    expect(kappa).toBe(1);
  });

  it('returns kappa -1 for fully inverted labels', () => {
    const maps = byRater({
      a: new Map([
        ['x', { pass: true }],
        ['y', { pass: false }],
      ]),
      b: new Map([
        ['x', { pass: false }],
        ['y', { pass: true }],
      ]),
    });
    expect(cohensKappa('a', 'b', maps).kappa).toBe(-1);
  });

  it('returns null kappa when there is no shared definite pair', () => {
    const maps = byRater({
      a: new Map([['x', { pass: true }]]),
      b: new Map([['y', { pass: false }]]),
    });
    expect(cohensKappa('a', 'b', maps).kappa).toBeNull();
  });
});

describe('calibration - report', () => {
  const t1 = [
    { id: 'validator_education_valid', rater: 't1', pass: true },
    { id: 'validator_education_absurd', rater: 't1', pass: false },
    { id: 'matrix_valid', rater: 't1', pass: true },
  ];
  const t2 = [
    { id: 'validator_education_valid', rater: 't2', pass: true },
    { id: 'validator_education_absurd', rater: 't2', pass: true }, // dispute vs t1
    { id: 'matrix_valid', rater: 't2', pass: true },
  ];

  it('computes agreement, disputes and pairwise kappa', () => {
    const report = buildCalibrationReport([
      { file: 'evals/calibration/t1.jsonl', annotations: t1 },
      { file: 'evals/calibration/t2.jsonl', annotations: t2 },
    ]);
    expect(report.nEntries).toBe(3);
    expect(report.raters.sort()).toEqual(['t1', 't2']);
    expect(report.pairwiseKappa).toHaveLength(1);
    expect(report.pairwiseKappa[0].n).toBe(3); // all three entries have definite labels from both raters
    // consensus: education_valid true, matrix_valid true (both agree) -> agreed with synthetic
    expect(report.agreement.nAgreed).toBe(2);
    // education_absurd: t1=false, t2=true -> tie -> no consensus
    expect(report.agreement.nWithoutConsensus).toBe(1);
    expect(report.disputed).toHaveLength(0);
  });

  it('flags invalid annotations instead of crashing', () => {
    const report = buildCalibrationReport([
      {
        file: 'evals/calibration/bad.jsonl',
        annotations: [
          { id: 'does-not-exist', rater: 't1', pass: true },
          { id: 'validator_education_valid', rater: '', pass: true },
        ],
      },
    ]);
    expect(report.nInvalidAnnotations).toBe(2);
    expect(report.raters).toEqual([]);
  });

  it('reports disputes when the teacher consensus differs from the synthetic label', () => {
    const annotations = [
      { id: 'validator_education_absurd', rater: 't1', pass: true },
      { id: 'validator_education_absurd', rater: 't2', pass: true },
    ];
    const report = buildCalibrationReport([
      { file: 'evals/calibration/t1.jsonl', annotations },
    ]);
    // single rater -> consensus = the rater's definite label
    expect(report.disputed.map((d) => d.id)).toContain('validator_education_absurd');
    expect(report.disputed[0]).toMatchObject({
      syntheticExpected: false,
      teacherConsensus: true,
    });
  });
});

describe('calibration - majority consensus helper', () => {
  it('breaks ties to null and honours the majority', () => {
    const byRater = new Map([
      ['a', new Map([['x', { pass: true }], ['y', { pass: false }]])],
      ['b', new Map([['x', { pass: true }], ['y', { pass: true }]])],
      ['c', new Map([['x', { pass: false }], ['y', { pass: true }]])],
    ]);
    const consensus = majorityConsensus(byRater, ['x', 'y']);
    expect(consensus.get('x')).toBe(true); // true 2 (a,b) vs false 1 (c)
    expect(consensus.get('y')).toBe(true); // true 2 (b,c) vs false 1 (a)
  });

  it('returns null on an exact tie', () => {
    const byRater = new Map([
      ['a', new Map([['x', { pass: true }]])],
      ['b', new Map([['x', { pass: false }]])],
    ]);
    expect(majorityConsensus(byRater, ['x']).get('x')).toBeNull();
  });
});
