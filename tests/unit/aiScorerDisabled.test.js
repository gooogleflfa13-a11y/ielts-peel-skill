import { expect, it } from 'vitest';
import { aiSemanticScore } from '../../server/evaluation/aiScorer.js';

it('disables the legacy AI scoring entry point', async () => {
  await expect(aiSemanticScore({ P: 'A point.' }, {})).rejects.toMatchObject({
    code: 'AI_SCORE_DISABLED',
    status: 400,
  });
});
