import { describe, expect, it } from 'vitest';
import { semanticQualityIssues } from '../../server/evaluation/semanticChecks.js';

const validPeel = {
  P: 'Community festivals strengthen social cohesion.',
  E1: 'Repeated shared activities create trust between neighbours who rarely meet.',
  E2: 'A parent cooks a traditional dish with family members at a neighbourhood festival.',
  L: 'Therefore, community festivals strengthen social cohesion.',
};

const codes = (issues) => issues.map((issue) => issue.code);

describe('semantic quality checks - valid PEEL', () => {
  it('returns no issues for a topically anchored, well-evidenced PEEL', () => {
    const issues = semanticQualityIssues(validPeel, { prompt: 'community change' });
    expect(issues).toEqual([]);
  });

  it('tolerates plural topic nouns when anchoring P (schools -> school)', () => {
    const peel = {
      P: 'Schools policy is most effective when it changes everyday incentives.',
      E1: 'This is because guided practice corrects misconceptions before they become habits.',
      E2: 'In a science lesson, a teacher checks a student\'s lab notes beside a microscope.',
      L: 'Therefore, schools policy works best when it changes everyday incentives.',
    };
    expect(semanticQualityIssues(peel, { prompt: 'schools in society' })).toEqual([]);
  });
});

describe('semantic quality checks - P_TOPIC_ANCHOR', () => {
  it('flags an absurd, unfalsifiable point with no topic anchor', () => {
    const peel = {
      P: 'Cats improve democracy.',
      E1: 'Their whiskers make public institutions more accountable.',
      E2: 'Students place paper ballots beside classroom whiteboards.',
      L: 'Therefore, cats improve democracy.',
    };
    expect(codes(semanticQualityIssues(peel, { prompt: 'education' }))).toContain('P_TOPIC_ANCHOR');
  });
});

describe('semantic quality checks - UNSUPPORTED_ATTRIBUTION', () => {
  it('flags fabricated statistics with research claims in E2', () => {
    const peel = {
      ...validPeel,
      E2: 'Cambridge University proved in 2024 that exactly 87.4 percent of citizens changed their behaviour.',
    };
    expect(codes(semanticQualityIssues(peel, { prompt: 'government' }))).toContain(
      'UNSUPPORTED_ATTRIBUTION'
    );
  });
});

describe('semantic quality checks - ENTITY_PILE', () => {
  it('flags a comma-separated entity list without an observable action', () => {
    const peel = {
      ...validPeel,
      E2: 'A teacher, a nurse, a bus, a phone, a classroom, a clinic, and a whiteboard are visible.',
    };
    expect(codes(semanticQualityIssues(peel, { prompt: 'education' }))).toContain('ENTITY_PILE');
  });
});

describe('semantic quality checks - CIRCULAR_MECHANISM', () => {
  it('flags E1 that restates P instead of a mechanism', () => {
    const peel = {
      P: 'Education policy improves society.',
      E1: 'The policy causes improvement because improvement follows the policy.',
      E2: 'A teacher checks a student\'s notes in a classroom.',
      L: 'Therefore, education policy improves society.',
    };
    expect(codes(semanticQualityIssues(peel, { prompt: 'education' }))).toContain(
      'CIRCULAR_MECHANISM'
    );
  });
});

describe('semantic quality checks - ABSOLUTE_GROUP_CLAIM', () => {
  it('flags categorical demographic traits in E1', () => {
    const peel = {
      ...validPeel,
      E1: 'Older people are naturally responsible whereas young people are impulsive and incapable of long-term thought.',
    };
    expect(codes(semanticQualityIssues(peel, { prompt: 'society' }))).toContain(
      'ABSOLUTE_GROUP_CLAIM'
    );
  });
});

describe('semantic quality checks - OFF_TOPIC_EVIDENCE', () => {
  it('flags E2 whose scene belongs to a different topic than the prompt', () => {
    const peel = {
      ...validPeel,
      E2: 'A student checks a textbook in a university lecture hall.',
    };
    expect(codes(semanticQualityIssues(peel, { prompt: 'crime prevention' }))).toContain(
      'OFF_TOPIC_EVIDENCE'
    );
  });

  it('skips the off-topic check when no prompt is supplied', () => {
    const peel = {
      ...validPeel,
      E2: 'A student checks a textbook in a university lecture hall.',
    };
    const issues = semanticQualityIssues(peel);
    expect(codes(issues)).not.toContain('OFF_TOPIC_EVIDENCE');
  });
});
