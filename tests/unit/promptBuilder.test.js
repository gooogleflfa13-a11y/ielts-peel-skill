import { describe, it, expect } from 'vitest';
import { buildPeelPrompt } from '../../server/prompts/peelPrompt.js';
import { loadTopicKnowledge } from '../../server/knowledge/topicRetriever.js';

describe('buildPeelPrompt', () => {
  it('injects matched topic lexicon', () => {
    const knowledge = loadTopicKnowledge('Education');
    const prompt = buildPeelPrompt({
      topicKnowledge: knowledge,
      topicId: 'Education',
    });
    expect(prompt).toContain('TOPIC CONTEXT');
    expect(prompt).toContain('Education');
    expect(prompt).toContain('E2 Physical Entity Bank');
    expect(prompt.length).toBeLessThan(8000);
  });

  it('falls back when no topic', () => {
    const prompt = buildPeelPrompt({});
    expect(prompt).toContain('Could not map');
    expect(prompt).toContain('[P]');
  });
});
