import { describe, expect, it } from 'vitest';
import { classifyPrompt, parsePeel, reviewPeel } from '../../packages/core/src/engine.js';

const validPeel = `[P] Community festivals strengthen social cohesion.
[E1] Repeated shared activities create trust between neighbours who rarely meet.
[E2] A parent cooks a traditional dish with family members at a neighbourhood festival.
[L] Therefore, community festivals strengthen social cohesion.`;

describe('core engine - classifyPrompt', () => {
  it('classifies plural prompts via stemming', () => {
    const { classification } = classifyPrompt(
      'Some people believe schools should receive more public investment than teachers.'
    );
    expect(classification.topicId).toBe('Education');
  });

  it('returns Unknown for off-topic gibberish', () => {
    const { classification } = classifyPrompt('What is the meaning of life?');
    expect(classification.topicId).toBeNull();
    expect(classification.label).toBe('Unknown');
  });
});

describe('core engine - parsePeel', () => {
  it('parses labeled PEEL text', () => {
    const parsed = parsePeel(validPeel);
    expect(parsed.ok).toBe(true);
    expect(parsed.peels).toHaveLength(1);
    expect(parsed.peels[0].P).toContain('Community festivals');
  });

  it('falls back to loose four-line parsing', () => {
    const parsed = parsePeel('Point sentence.\nMechanism sentence.\nExample sentence.\nLink sentence.');
    expect(parsed.ok).toBe(true);
    expect(parsed.peels).toHaveLength(1);
  });
});

describe('core engine - reviewPeel', () => {
  it('passes a valid, on-topic PEEL', () => {
    const result = reviewPeel(validPeel, { prompt: 'community change' });
    expect(result.validation.passed).toBe(true);
    expect(result.feedback.status).toBe('no_issues_detected');
  });

  it('flags an absurd, topic-less point', () => {
    const result = reviewPeel(
      `[P] Cats improve democracy.
[E1] Their whiskers make public institutions more accountable.
[E2] Students place paper ballots beside classroom whiteboards.
[L] Therefore, cats improve democracy.`,
      { prompt: 'education' }
    );
    expect(result.validation.passed).toBe(false);
    expect(result.validation.issues.some((issue) => issue.code === 'P_TOPIC_ANCHOR')).toBe(true);
  });

  it('flags off-topic evidence when a prompt is provided', () => {
    const result = reviewPeel(
      `[P] Crime policy can improve long-term outcomes.
[E1] This is because visible guardianship raises the likelihood of detection.
[E2] A student checks a textbook in a university lecture hall.
[L] Therefore, crime policy can improve long-term outcomes.`,
      { prompt: 'crime prevention' }
    );
    expect(result.validation.passed).toBe(false);
    expect(result.validation.issues.some((issue) => issue.code === 'OFF_TOPIC_EVIDENCE')).toBe(true);
  });

  it('returns criterion proxy feedback mapped to IELTS dimensions', () => {
    const result = reviewPeel(validPeel, { prompt: 'community change', skill: 'speaking' });
    expect(result.criterionFeedback.criteria).toHaveProperty('FC');
    expect(result.criterionFeedback.criteria).toHaveProperty('PR');
    expect(result.criterionFeedback.scope).toBe('criterion_aligned_structural_proxy');
  });
});
