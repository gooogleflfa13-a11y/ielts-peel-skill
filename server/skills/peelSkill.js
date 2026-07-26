import { buildPeelPrompt } from '../prompts/peelPrompt.js';
import { callLLM } from '../utils/llmClient.js';
import { detectEntities } from '../evaluation/validator.js';
import { retrieveTopic } from '../knowledge/topicRetriever.js';
import { createNullMemoryStore } from '../memory/memoryStore.js';
import {
  sanitizeUserInput,
  wrapAsTaskPayload,
} from '../utils/sanitize.js';
import { MAX_INPUT_CHARS } from '../utils/constants.js';
import {
  buildRepairInstruction,
  evaluatePeelOutput,
  finalizeGeneratedOutput,
} from '../evaluation/outputQuality.js';

export async function runPeelSkill({
  input,
  history = [],
  apiKey,
  baseUrl,
  model,
  userId = 'default',
  memoryStore = createNullMemoryStore(),
}, { llmRuntime } = {}) {
  const { clean: safeInput } = sanitizeUserInput(input, {
    maxLen: MAX_INPUT_CHARS,
  });
  const { classification, knowledge: topicKnowledge } = retrieveTopic(safeInput);

  const memoryContext = { userId };
  const userFuel = await memoryStore.getRelevantFuel(
    memoryContext,
    classification?.topicId
  );
  const fuelHint =
    userFuel.length > 0
      ? `\n[USER E2 FUEL — prefer these personal entities]: ${userFuel
          .map((f) => f.entity)
          .join(' | ')}\n`
      : '';

  const system = buildPeelPrompt({
    topicKnowledge,
    topicId: classification.topicId,
    fuelHint,
  });

  const userMessage = safeInput.trim().startsWith('/peel')
    ? safeInput.trim()
    : `/peel ${safeInput.trim()}`;
  const wrappedUser = wrapAsTaskPayload(userMessage);

  const { content, usage } = await callLLM({
    apiKey,
    model,
    system,
    user: wrappedUser,
    history,
  }, llmRuntime);

  const finalized = await finalizeGeneratedOutput({
    content,
    usage,
    evaluate: (candidate) => evaluatePeelOutput(candidate, { minPeels: 1, maxPeels: 1 }),
    repair: ({ content: failedContent, issues }) =>
      callLLM({
        apiKey,
        model,
        system,
        user: buildRepairInstruction(issues),
        history: [
          ...history,
          { role: 'user', content: wrappedUser },
          { role: 'assistant', content: failedContent },
        ],
      }, llmRuntime),
  });

  if (!finalized.ok) {
    return {
      ...finalized,
      topic: {
        id: classification.topicId,
        score: classification.score,
        matchedKeywords: classification.matchedKeywords,
      },
      entities: [],
    };
  }

  await memoryStore.recordResult(memoryContext, {
    topicId: classification.topicId,
    validation: finalized.validation,
    command: 'peel',
    source: 'agent',
  });

  const entities = (finalized.parsed.peels || []).flatMap((p) =>
    detectEntities([p.P, p.E1, p.E2, p.L].join(' '))
  );

  return {
    ...finalized,
    topic: {
      id: classification.topicId,
      score: classification.score,
      matchedKeywords: classification.matchedKeywords,
    },
    entities,
  };
}
