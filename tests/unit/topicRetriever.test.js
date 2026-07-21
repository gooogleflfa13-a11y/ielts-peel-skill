import { describe, it, expect } from 'vitest';
import {
  classifyTopic,
  retrieveTopic,
  loadTopicKnowledge,
} from '../../server/knowledge/topicRetriever.js';

describe('topicRetriever', () => {
  it('classifies education prompts', () => {
    const r = classifyTopic(
      'Some people think online education can replace traditional classrooms.'
    );
    expect(r.topicId).toBe('Education');
    expect(r.score).toBeGreaterThanOrEqual(2);
  });

  it('classifies technology prompts', () => {
    const r = classifyTopic('Social media and smartphones make people lonely.');
    expect(r.topicId).toBe('Technology');
  });

  it('loads topic knowledge JSON', () => {
    const k = loadTopicKnowledge('Education');
    expect(k?.topic).toBe('Education');
    expect(k?.nodes?.length).toBeGreaterThan(0);
    expect(k?.e2Entities?.people?.length).toBeGreaterThan(0);
  });

  it('retrieveTopic returns knowledge for matched topic', () => {
    const { classification, knowledge } = retrieveTopic(
      'Should governments tax junk food to reduce obesity and improve health?'
    );
    expect(classification.topicId).toBeTruthy();
    expect(knowledge).toBeTruthy();
  });
});
