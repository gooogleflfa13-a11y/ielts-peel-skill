import { describe, it, expect } from 'vitest';
import { validatePeel } from '../../server/evaluation/validator.js';

describe('PEEL Validator', () => {
  it('passes a well-formed PEEL', () => {
    const peel = {
      P: 'The absence of physical schooling breeds deficits in social competency.',
      E1: 'This means young people miss the daily peer-to-peer negotiations that teach conflict resolution and empathy.',
      E2: 'Take university seminar rooms: students who study entirely online never build the impromptu study groups at whiteboards that become lifelong professional networks.',
      L: 'Thus, physical schooling plays an irreplaceable role in holistic education.',
    };
    const result = validatePeel(peel);
    expect(result.warnings.filter((w) => w.includes('E2 lacks'))).toHaveLength(0);
    expect(result.score.structure).toBe(1);
  });

  it('flags P with causal chain', () => {
    const peel = {
      P: 'Online education reduces social skills because students do not interact face to face, which leads to weaker communication abilities.',
      E1: 'This is important.',
      E2: 'For example, students at universities.',
      L: 'So it matters.',
    };
    const result = validatePeel(peel);
    expect(result.warnings.some((w) => w.includes('P has'))).toBe(true);
  });

  it('flags E2 without physical entities', () => {
    const peel = {
      P: 'Online education weakens social skills.',
      E1: 'This happens because interaction is reduced.',
      E2: 'Research shows that this abstract factor is highly significant for overall outcomes in general terms.',
      L: 'So it matters.',
    };
    const result = validatePeel(peel);
    expect(result.warnings.some((w) => w.includes('E2 lacks'))).toBe(true);
    expect(result.score.physical).toBe(0);
  });

  it('detects banned discourse glue', () => {
    const peel = {
      P: 'Online education weakens social skills.',
      E1: 'This happens because interaction is reduced.',
      E2: 'For example, students at universities use apps to communicate.',
      L: 'In conclusion, this is a serious issue.',
    };
    const result = validatePeel(peel);
    expect(result.warnings.some((w) => w.includes('Banned'))).toBe(true);
  });

  it('requires exactly one sentence in every layer', () => {
    const result = validatePeel({
      P: 'Physical schooling develops social competence.',
      E1: 'Daily peer negotiation teaches empathy.',
      E2: 'Students form study groups around classroom whiteboards.',
      L: 'Thus, classroom attendance supports holistic education. It also saves money.',
    });

    expect(result.passed).toBe(false);
    expect(result.checks.layerBoundaries).toBe('fail');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          layer: 'L',
          code: 'SENTENCE_COUNT',
          evidence: expect.any(String),
          action: expect.any(String),
        }),
      ])
    );
  });

  it('rejects a causal connector in P', () => {
    const result = validatePeel({
      P: 'Physical schooling matters because students need social competence.',
      E1: 'Daily peer negotiation teaches empathy.',
      E2: 'Students form study groups around classroom whiteboards.',
      L: 'Thus, classroom attendance supports holistic education.',
    });

    expect(result.passed).toBe(false);
    expect(result.checks.layerBoundaries).toBe('fail');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ layer: 'P', code: 'P_CAUSAL_CHAIN' }),
      ])
    );
  });

  it('reports weak E2 as a named concreteness issue', () => {
    const result = validatePeel({
      P: 'Physical schooling develops social competence.',
      E1: 'Daily interaction reinforces social learning.',
      E2: 'This general tendency produces broadly positive outcomes.',
      L: 'Thus, classroom attendance supports holistic education.',
    });

    expect(result.passed).toBe(false);
    expect(result.checks.e2Concreteness).toBe('fail');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ layer: 'E2', code: 'E2_NOT_CONCRETE' }),
      ])
    );
  });

  it('fails closed with named issues when a layer is missing', () => {
    const result = validatePeel({
      P: 'Physical schooling develops social competence.',
      E1: 'Daily peer negotiation teaches empathy.',
      E2: '',
      L: 'Thus, classroom attendance supports holistic education.',
    });

    expect(result.passed).toBe(false);
    expect(result.checks.labels).toBe('fail');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ layer: 'E2', code: 'MISSING_LAYER' }),
      ])
    );
  });

  it('rejects a sentence fragment without terminal punctuation', () => {
    const result = validatePeel({
      P: 'Physical schooling develops social competence.',
      E1: 'Daily peer negotiation teaches empathy.',
      E2: 'Students form study groups around classroom whiteboards.',
      L: 'Thus, physical schooling supports holistic education',
    });

    expect(result.passed).toBe(false);
    expect(result.checks.layerBoundaries).toBe('fail');
    expect(result.checks.linkClosure).toBe('fail');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          layer: 'L',
          code: 'TERMINAL_PUNCTUATION',
        }),
      ])
    );
  });

  it('rejects an L that does not close back to P', () => {
    const result = validatePeel({
      P: 'Physical schooling develops social competence.',
      E1: 'Daily peer negotiation teaches empathy.',
      E2: 'Students form study groups around classroom whiteboards.',
      L: 'Thus, economic policy remains important for national growth.',
    });

    expect(result.passed).toBe(false);
    expect(result.checks.linkClosure).toBe('fail');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ layer: 'L', code: 'L_NOT_CLOSED' }),
      ])
    );
  });
});
