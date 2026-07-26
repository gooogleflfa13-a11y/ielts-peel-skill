import { describe, expect, it } from 'vitest';
import { buildStructuralFeedback } from '../../server/evaluation/structuralFeedback.js';
import { runScoreSkill } from '../../server/skills/scoreSkill.js';

const validPeel = {
  P: 'Physical schooling remains essential to social development.',
  E1: 'Daily peer negotiation teaches students how to resolve disagreement.',
  E2: 'In university seminar rooms, students form study groups around whiteboards.',
  L: 'Therefore, classroom attendance supports social development.',
};

describe('PEEL structural feedback', () => {
  it('returns no_issues_detected with the approved disclaimer for valid PEEL', () => {
    const result = buildStructuralFeedback(
      { ok: true, peels: [validPeel] },
      { passed: true, allWarnings: [] }
    );

    expect(result.feedback).toEqual({
      scope: 'peel_structure_only',
      status: 'no_issues_detected',
      checks: {
        labels: 'pass',
        layerBoundaries: 'pass',
        e2Concreteness: 'pass',
        linkClosure: 'pass',
        bannedGlue: 'pass',
      },
      issues: [],
    });
    expect(result.disclaimer).toBe(
      'PEEL structure feedback only. Not an official IELTS assessment or band estimate.'
    );
  });

  it('returns issues_found with evidence and a revision action', () => {
    const result = buildStructuralFeedback(
      { ok: true, peels: [validPeel] },
      {
        passed: false,
        allWarnings: [
          'E2 lacks ANY physical entity - add a concrete person/place/object/action',
        ],
      }
    );

    expect(result.feedback.status).toBe('issues_found');
    expect(result.feedback.checks.e2Concreteness).toBe('fail');
    expect(result.feedback.issues[0]).toMatchObject({
      layer: 'E2',
      code: 'E2_CONCRETENESS',
    });
    expect(result.feedback.issues[0].evidence).toContain('E2 lacks');
    expect(result.feedback.issues[0].action).toMatch(/person|place|object|action/i);
  });

  it('maps an E1 boundary warning to layer boundaries rather than E2 concreteness', () => {
    const result = buildStructuralFeedback(
      { ok: true, peels: [validPeel] },
      {
        passed: false,
        allWarnings: ['E1 contains concrete entities - move to E2'],
      }
    );

    expect(result.feedback.checks.layerBoundaries).toBe('fail');
    expect(result.feedback.checks.e2Concreteness).toBe('pass');
    expect(result.feedback.issues[0]).toMatchObject({
      layer: 'E1',
      code: 'LAYER_BOUNDARIES',
    });
  });

  it('returns unparseable for malformed input', () => {
    const result = buildStructuralFeedback(
      { ok: false, code: 'INVALID_LABEL_ORDER', issues: [], peels: [] },
      { passed: false, allWarnings: [] }
    );

    expect(result.feedback.status).toBe('unparseable');
    expect(result.feedback.checks.labels).toBe('fail');
    expect(result.feedback.issues[0]).toMatchObject({ code: 'UNPARSEABLE' });
  });

  it('treats incomplete legacy parser output as unparseable', () => {
    const result = buildStructuralFeedback(
      { peels: [{ P: 'Point.', E1: 'Mechanism.', E2: 'Example.', L: '' }] },
      { passed: false, allWarnings: ['Missing labels: L'] }
    );

    expect(result.feedback.status).toBe('unparseable');
    expect(result.feedback.checks.labels).toBe('fail');
  });

  it('score command exposes no numeric, semantic, or examiner-style fields', async () => {
    const input = `[P] ${validPeel.P}\n[E1] ${validPeel.E1}\n[E2] ${validPeel.E2}\n[L] ${validPeel.L}`;
    const result = await runScoreSkill({ input, aiScore: true, apiKey: 'unused' });
    const serialized = JSON.stringify(result);

    expect(result.feedback.scope).toBe('peel_structure_only');
    expect(result.disclaimer).toContain('Not an official IELTS assessment');
    expect(serialized).not.toMatch(/"semantic"|"overall"|"P_score"|"E1_score"|"score"\s*:/i);
    expect(serialized).not.toMatch(/examiner/i);
  });

  it('rejects malformed three-line loose score input as unparseable', async () => {
    const result = await runScoreSkill({
      input: [
        'Physical schooling supports social development.',
        'Daily peer negotiation teaches conflict resolution.',
        'Students form study groups around classroom whiteboards.',
      ].join('\n'),
    });

    expect(result.feedback.status).toBe('unparseable');
    expect(result.feedback.checks.labels).toBe('fail');
    expect(result.parsed.peels).toEqual([]);
  });

});
