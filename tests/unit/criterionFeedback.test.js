import { describe, expect, it } from 'vitest';
import {
  CRITERION_FEEDBACK_DISCLAIMER,
  buildCriterionFeedback,
} from '../../server/evaluation/criterionFeedback.js';

const VALID_PEEL = {
  ok: true,
  peels: [
    {
      P: 'Remote work increases productivity.',
      E1: 'Employees avoid the stress of commuting.',
      E2: 'In a Tokyo tech firm, engineers who worked from home finished sprints 20 percent faster.',
      L: 'Thus, remote work clearly boosts productivity.',
    },
  ],
};

const CLEAN_VALIDATION = {
  passed: true,
  checks: {
    labels: 'pass',
    layerBoundaries: 'pass',
    e2Concreteness: 'pass',
    linkClosure: 'pass',
    bannedGlue: 'pass',
  },
  issues: [],
  warnings: [],
};

const FAILED_VALIDATION = {
  passed: false,
  checks: {
    labels: 'pass',
    layerBoundaries: 'fail',
    e2Concreteness: 'fail',
    linkClosure: 'fail',
    bannedGlue: 'fail',
  },
  issues: [
    {
      layer: 'E2',
      code: 'E2_NOT_CONCRETE',
      evidence: 'It is good.',
      action: 'Add a concrete person, place, object, or observable action.',
    },
    {
      layer: 'L',
      code: 'L_NOT_CLOSED',
      evidence: 'No overlap with P.',
      action: 'Begin with a closing cue and restate a key term from P.',
    },
    {
      code: 'BANNED_GLUE',
      evidence: 'in conclusion',
      action: 'Remove formulaic discourse glue.',
    },
    {
      layer: 'E1',
      code: 'SENTENCE_COUNT',
      evidence: '2 sentences in [E1]',
      action: 'Rewrite [E1] as exactly one sentence.',
    },
  ],
  warnings: [
    'E2 lacks ANY physical entity',
    'L does not close explicitly back to P',
    'Banned discourse glue detected',
    'E1 must contain exactly one sentence',
  ],
};

const UNPARSEABLE = { ok: false, code: 'NO_LABELS' };

describe('Criterion Feedback', () => {
  describe('writing skill', () => {
    it('returns exactly TR, CC, LR, GRA criteria', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: CLEAN_VALIDATION,
      });
      const codes = Object.keys(result.criteria).sort();
      expect(codes).toEqual(['CC', 'GRA', 'LR', 'TR']);
    });

    it('each criterion has status and notes', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: CLEAN_VALIDATION,
      });
      for (const code of ['TR', 'CC', 'LR', 'GRA']) {
        const criterion = result.criteria[code];
        expect(typeof criterion.status).toBe('string');
        expect(['pass', 'watch', 'fail', 'not_assessed']).toContain(criterion.status);
        expect(typeof criterion.notes).toBe('string');
        expect(criterion.notes.length).toBeGreaterThan(0);
      }
    });

    it('marks all criteria as pass when validation is clean', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: CLEAN_VALIDATION,
      });
      for (const code of ['TR', 'CC', 'LR', 'GRA']) {
        expect(result.criteria[code].status).toBe('pass');
      }
    });

    it('marks TR as fail when e2Concreteness fails', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: {
          ...FAILED_VALIDATION,
          checks: { ...FAILED_VALIDATION.checks, labels: 'pass' },
        },
      });
      expect(result.criteria.TR.status).toBe('fail');
      expect(result.criteria.TR.notes).toMatch(/concrete|evidence|example/i);
    });

    it('marks CC as fail when layerBoundaries, linkClosure, or bannedGlue fails', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: FAILED_VALIDATION,
      });
      expect(result.criteria.CC.status).toBe('fail');
      expect(result.criteria.CC.notes.length).toBeGreaterThan(0);
    });

    it('marks LR as fail when bannedGlue fails (formulaic language)', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: FAILED_VALIDATION,
      });
      expect(result.criteria.LR.status).toBe('fail');
      expect(result.criteria.LR.notes).toMatch(/formulaic|lexical|glue/i);
    });

    it('marks GRA as fail when layerBoundaries fails (sentence structure)', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: FAILED_VALIDATION,
      });
      expect(result.criteria.GRA.status).toBe('fail');
    });
  });

  describe('speaking skill', () => {
    it('returns exactly FC, LR, GRA, PR criteria', () => {
      const result = buildCriterionFeedback({
        skill: 'speaking',
        parseResult: VALID_PEEL,
        validation: CLEAN_VALIDATION,
      });
      const codes = Object.keys(result.criteria).sort();
      expect(codes).toEqual(['FC', 'GRA', 'LR', 'PR']);
    });

    it('marks PR as not_assessed because pronunciation cannot be assessed from text', () => {
      const result = buildCriterionFeedback({
        skill: 'speaking',
        parseResult: VALID_PEEL,
        validation: CLEAN_VALIDATION,
      });
      expect(result.criteria.PR.status).toBe('not_assessed');
      expect(result.criteria.PR.notes).toMatch(/pronunciation|cannot|text|audio/i);
    });

    it('labels the result as a criterion-aligned structural proxy', () => {
      const result = buildCriterionFeedback({
        skill: 'speaking',
        parseResult: VALID_PEEL,
        validation: CLEAN_VALIDATION,
      });
      expect(result.scope).toBe('criterion_aligned_structural_proxy');
      expect(result.disclaimer).toMatch(/proxy|structural/i);
    });

    it('marks FC as fail when coherence checks fail', () => {
      const result = buildCriterionFeedback({
        skill: 'speaking',
        parseResult: VALID_PEEL,
        validation: FAILED_VALIDATION,
      });
      expect(result.criteria.FC.status).toBe('fail');
    });

    it('never includes TR for speaking', () => {
      const result = buildCriterionFeedback({
        skill: 'speaking',
        parseResult: VALID_PEEL,
        validation: CLEAN_VALIDATION,
      });
      expect(result.criteria).not.toHaveProperty('TR');
    });

    it('never includes CC for speaking', () => {
      const result = buildCriterionFeedback({
        skill: 'speaking',
        parseResult: VALID_PEEL,
        validation: CLEAN_VALIDATION,
      });
      expect(result.criteria).not.toHaveProperty('CC');
    });
  });

  describe('disclaimer and band score', () => {
    it('always includes the disclaimer', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: CLEAN_VALIDATION,
      });
      expect(result.disclaimer).toBe(CRITERION_FEEDBACK_DISCLAIMER);
      expect(result.disclaimer.length).toBeGreaterThan(0);
    });

    it('includes the disclaimer even when unparseable', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: UNPARSEABLE,
        validation: null,
      });
      expect(result.disclaimer).toBe(CRITERION_FEEDBACK_DISCLAIMER);
    });

    it('never includes a band score', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: CLEAN_VALIDATION,
      });
      expect(result).not.toHaveProperty('band');
      expect(result).not.toHaveProperty('bandScore');
      expect(result).not.toHaveProperty('score');
      for (const code of Object.keys(result.criteria)) {
        expect(result.criteria[code]).not.toHaveProperty('band');
        expect(result.criteria[code]).not.toHaveProperty('score');
      }
    });
  });

  describe('structural mapping determinism', () => {
    it('maps unparseable input to all-fail with structural note', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: UNPARSEABLE,
        validation: null,
      });
      for (const code of ['TR', 'CC', 'LR', 'GRA']) {
        expect(result.criteria[code].status).toBe('fail');
      }
      expect(result.criteria.TR.notes).toMatch(/structure|parse|label|complete/i);
    });

    it('maps labels failure to TR fail (task not addressed)', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: {
          passed: false,
          checks: {
            labels: 'fail',
            layerBoundaries: 'pass',
            e2Concreteness: 'pass',
            linkClosure: 'pass',
            bannedGlue: 'pass',
          },
          issues: [
            {
              layer: 'P',
              code: 'MISSING_LAYER',
              evidence: '[P] is empty',
              action: 'Provide [P].',
            },
          ],
          warnings: ['Missing labels: P'],
        },
      });
      expect(result.criteria.TR.status).toBe('fail');
    });

    it('produces the same output for the same input (deterministic)', () => {
      const input = {
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: FAILED_VALIDATION,
      };
      const a = buildCriterionFeedback(input);
      const b = buildCriterionFeedback(input);
      expect(a).toEqual(b);
    });

    it('notes reference the specific structural issues found', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: FAILED_VALIDATION,
      });
      const allNotes = Object.values(result.criteria)
        .map((c) => c.notes)
        .join(' ');
      expect(allNotes).toMatch(/concrete|closure|glue|sentence/i);
    });
  });

  describe('edge cases', () => {
    it('defaults to writing when skill is omitted', () => {
      const result = buildCriterionFeedback({
        parseResult: VALID_PEEL,
        validation: CLEAN_VALIDATION,
      });
      expect(Object.keys(result.criteria).sort()).toEqual(['CC', 'GRA', 'LR', 'TR']);
    });

    it('handles missing validation gracefully', () => {
      const result = buildCriterionFeedback({
        skill: 'writing',
        parseResult: VALID_PEEL,
        validation: null,
      });
      expect(result.criteria).toBeDefined();
      expect(result.disclaimer).toBe(CRITERION_FEEDBACK_DISCLAIMER);
    });
  });
});
