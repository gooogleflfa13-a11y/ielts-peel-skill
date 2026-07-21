import { callLLM } from '../utils/llmClient.js';

/**
 * Optional AI semantic scoring — cold examiner JSON scores.
 */
export async function aiSemanticScore(peel, { apiKey, baseUrl, model }) {
  if (!peel?.P) return null;

  const evalPrompt = `You are an IELTS writing examiner. Score this PEEL paragraph on 4 dimensions (1-9 scale, 0.5 increments):

[P] ${peel.P}
[E1] ${peel.E1}
[E2] ${peel.E2}
[L] ${peel.L}

Respond ONLY with a JSON object:
{
  "P_score": <task response quality — abstract, clear, qualifying, 1-9>,
  "E1_score": <explanation quality — causal mechanism depth, 1-9>,
  "E2_score": <example quality — physicality, concreteness, 1-9>,
  "L_score": <link quality — closure, no new info, 1-9>,
  "overall": <weighted average, 1-9>,
  "topIssue": "<one-line: most critical weakness>"
}`;

  const result = await callLLM({
    apiKey,
    baseUrl,
    model,
    system:
      'You are an IELTS examiner. Score coldly. No encouragement. Return JSON only.',
    user: evalPrompt,
    temperature: 0.1,
    maxTokens: 300,
  });

  try {
    const raw = result.content.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
