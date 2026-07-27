import { describe, it, expect } from 'vitest';
import {
  classifyTopic,
  retrieveTopic,
  matchReductionModel,
} from '../../server/knowledge/topicRetriever.js';

describe('topic routing - word boundary matching', () => {
  it('classifies on a single strong exact keyword match', () => {
    const r = classifyTopic('Tell me about online education.');
    expect(r.topicId).toBe('Education');
    expect(r.score).toBeGreaterThanOrEqual(2);
  });

  it('prevents substring false matches via word boundaries', () => {
    // "app" is a Technology keyword; it must NOT match inside "apple".
    const r = classifyTopic('I love apple juice and organic food.');
    expect(r.topicId).not.toBe('Technology');
    expect(r.label).toBe('Unknown');
  });

  it('does not match plural forms of a singular keyword as exact matches', () => {
    // "governments" should not be treated as the exact keyword "government".
    // The prompt has no other Government keyword, so it must stay Unknown.
    const r = classifyTopic('Governments should do something about this.');
    expect(r.label).toBe('Unknown');
  });
});

describe('topic routing - Unknown handling', () => {
  it('returns an explicit Unknown label (not null) when nothing matches', () => {
    const r = classifyTopic('What is the meaning of life?');
    expect(r.topicId).toBeNull();
    expect(r.label).toBe('Unknown');
    expect(r.score).toBe(0);
    expect(r.confidence).toBe(0);
    expect(r.matchedTopics).toEqual([]);
  });

  it('retrieveTopic returns null knowledge for Unknown prompts', () => {
    const { classification, knowledge } = retrieveTopic('What is the meaning of life?');
    expect(classification.label).toBe('Unknown');
    expect(knowledge).toBeNull();
  });
});

describe('topic routing - confidence and multi-topic detection', () => {
  it('reports a confidence score between 0 and 1 for a matched topic', () => {
    const r = classifyTopic('Tell me about online education.');
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it('detects multiple topics and orders them by score descending', () => {
    const r = classifyTopic(
      'How does social media affect university students?'
    );
    expect(r.matchedTopics.length).toBeGreaterThanOrEqual(2);
    const ids = r.matchedTopics.map((m) => m.topicId);
    expect(ids).toContain('Education');
    expect(ids).toContain('Technology');
    // highest confidence / score first
    for (let i = 1; i < r.matchedTopics.length; i++) {
      expect(r.matchedTopics[i - 1].score).toBeGreaterThanOrEqual(
        r.matchedTopics[i].score
      );
    }
    expect(r.topicId).toBe(r.matchedTopics[0].topicId);
  });
});

describe('topic routing - reduction model fallback', () => {
  it('matchReductionModel returns Unknown instead of forcing Model C when nothing triggers', () => {
    const r = matchReductionModel('What is the meaning of life?');
    expect(r.id).toBe('Unknown');
    expect(r.score).toBe(0);
  });

  it('matchReductionModel still matches a real trigger', () => {
    const r = matchReductionModel('online vs campus learning');
    expect(['A', 'B', 'C']).toContain(r.id);
    expect(r.score).toBeGreaterThan(0);
  });
});
