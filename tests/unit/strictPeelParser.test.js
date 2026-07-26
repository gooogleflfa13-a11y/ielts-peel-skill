import { describe, expect, it } from 'vitest';
import { parsePeelOutput } from '../../server/parsing/peelParser.js';

const validPeel = `[P] Physical schooling develops social competence.
[E1] Daily peer negotiation teaches conflict resolution and empathy.
[E2] Students in university seminar rooms form study groups around whiteboards.
[L] Thus, classroom attendance supports holistic education.`;

describe('strict PEEL parser', () => {
  it('accepts uppercase labels in exact order', () => {
    const result = parsePeelOutput(validPeel);

    expect(result.ok).toBe(true);
    expect(result.peels).toHaveLength(1);
  });

  it('normalizes lowercase labels to uppercase keys', () => {
    const result = parsePeelOutput(validPeel.toLowerCase());

    expect(result.ok).toBe(true);
    expect(result.peels[0]).toHaveProperty('E1');
    expect(result.peels[0]).not.toHaveProperty('e1');
  });

  it.each([
    ['duplicate', `${validPeel}\n[E2] A duplicate example.`, 'DUPLICATE_LABEL'],
    [
      'reordered',
      `[P] Point.\n[E2] Example school.\n[E1] Explanation.\n[L] Thus, link.`,
      'LABEL_ORDER',
    ],
    ['missing', `[P] Point.\n[E1] Explanation.\n[L] Thus, link.`, 'MISSING_LABEL'],
    [
      'unknown extra',
      `${validPeel}\n[NOTE] This must not be accepted.`,
      'UNKNOWN_LABEL',
    ],
  ])('rejects %s labels', (_name, text, issueCode) => {
    const result = parsePeelOutput(text);

    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_PEEL_STRUCTURE');
    expect(result.peels).toEqual([]);
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: issueCode })])
    );
  });

  it('parses two units only when each unit is independently valid', () => {
    const valid = parsePeelOutput(`${validPeel}\n${validPeel}`);
    const invalid = parsePeelOutput(
      `${validPeel}\n[P] Second point.\n[E1] Second explanation.\n[L] Thus, second link.`
    );

    expect(valid.ok).toBe(true);
    expect(valid.peels).toHaveLength(2);
    expect(invalid.ok).toBe(false);
    expect(invalid.peels).toEqual([]);
  });

  it('does not include trailing metadata in L', () => {
    const result = parsePeelOutput(`${validPeel}

---
底层逻辑：教育 · 社会节点
Model B: Physical Presence vs Virtual`);

    expect(result.ok).toBe(true);
    expect(result.peels[0].L).toBe(
      'Thus, classroom attendance supports holistic education.'
    );
    expect(result.meta).toBe('教育 · 社会节点');
    expect(result.model).toEqual({
      id: 'B',
      label: 'Physical Presence vs Virtual',
    });
  });

  it('rejects an extra malformed bracket label containing spaces', () => {
    const result = parsePeelOutput(`${validPeel}\n[NOT A LABEL] hidden metadata`);

    expect(result.ok).toBe(false);
    expect(result.peels).toEqual([]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'UNKNOWN_LABEL',
          evidence: '[NOT A LABEL]',
        }),
      ])
    );
  });
});
