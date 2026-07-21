import { describe, it, expect } from 'vitest';
import { retrieveTopic } from '../../server/knowledge/topicRetriever.js';
import { buildPeelPrompt } from '../../server/prompts/peelPrompt.js';
import { parsePeelOutput } from '../../server/parsing/peelParser.js';
import { validatePeels } from '../../server/evaluation/validator.js';
import cases from '../golden/peel-cases.json';

describe('pipeline (offline)', () => {
  for (const c of cases) {
    it(`classifies ${c.id}`, () => {
      const { classification, knowledge } = retrieveTopic(c.input);
      expect(classification.topicId).toBe(c.expectedTopic);
      expect(knowledge).toBeTruthy();
      const system = buildPeelPrompt({
        topicKnowledge: knowledge,
        topicId: classification.topicId,
      });
      expect(system).toContain('FOUR SENTENCE LOCK');
    });
  }

  it('score pipeline validates sample peel text', () => {
    const sample = `[P] The absence of physical schooling breeds deficits in social competency.
[E1] This means young people miss peer-to-peer negotiations that teach empathy.
[E2] Take university seminar rooms: students never build study groups at whiteboards.
[L] Thus physical attendance remains essential.`;
    const parsed = parsePeelOutput(sample);
    const validation = validatePeels(parsed.peels);
    expect(parsed.peels).toHaveLength(1);
    expect(validation.summary.structure).toBe(1);
  });
});
