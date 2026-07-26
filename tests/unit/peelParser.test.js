import { describe, it, expect } from 'vitest';
import { parsePeelOutput, parseLooseLines } from '../../server/parsing/peelParser.js';

describe('peelParser', () => {
  it('parses labeled PEEL blocks', () => {
    const text = `[P] Abstract claim here.
[E1] Mechanism explanation here.
[E2] University seminar rooms and whiteboards.
[L] Therefore attendance matters.

---
底层逻辑：教育 · 社会节点 · 缺失模型 · seminar rooms`;

    const parsed = parsePeelOutput(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.peels).toHaveLength(1);
    expect(parsed.peels[0].P).toMatch(/Abstract/);
    expect(parsed.peels[0].E2).toMatch(/seminar/);
    expect(parsed.meta).toMatch(/教育/);
  });

  it('parses multiple PEEL units', () => {
    const text = `[P] One.
[E1] Two.
[E2] Three school.
[L] Four.
[P] Five.
[E1] Six.
[E2] Seven hospital.
[L] Eight.`;
    const parsed = parsePeelOutput(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.peels.length).toBe(2);
  });

  it('parseLooseLines maps 4 lines', () => {
    const peel = parseLooseLines('a\nb\nc\nd');
    expect(peel).toEqual({ P: 'a', E1: 'b', E2: 'c', L: 'd' });
  });
});
