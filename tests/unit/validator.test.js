import { describe, it, expect } from 'vitest';
import { validatePeel } from '../../server/evaluation/validator.js';

describe('PEEL Validator', () => {
  it('passes a well-formed PEEL', () => {
    const peel = {
      P: 'The absence of physical schooling breeds deficits in social competency.',
      E1: 'This means young people miss the daily peer-to-peer negotiations that teach conflict resolution and empathy.',
      E2: 'Take university seminar rooms: students who study entirely online never build the impromptu study groups at whiteboards that become lifelong professional networks.',
      L: 'Thus, physical attendance plays an irreplaceable role in holistic education.',
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
});
