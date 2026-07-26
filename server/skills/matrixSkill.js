import { buildMatrixPrompt } from '../prompts/matrixPrompt.js';
import { callLLM } from '../utils/llmClient.js';
import { detectEntities } from '../evaluation/validator.js';
import {
  retrieveTopic,
  matchReductionModel,
} from '../knowledge/topicRetriever.js';
import { createNullMemoryStore } from '../memory/memoryStore.js';
import {
  buildRepairInstruction,
  evaluatePeelOutput,
  finalizeGeneratedOutput,
  matrixContractIssues,
} from '../evaluation/outputQuality.js';

export async function runMatrixSkill({
  input,
  history = [],
  apiKey,
  baseUrl,
  model,
  userId = 'default',
  memoryStore = createNullMemoryStore(),
}, { llmRuntime } = {}) {
  const { classification, knowledge: topicKnowledge } = retrieveTopic(input);
  const reductionModel = matchReductionModel(input);

  const system = buildMatrixPrompt({
    topicKnowledge,
    topicId: classification.topicId,
    reductionModel,
  });

  const userMessage = input.trim().startsWith('/matrix')
    ? input.trim()
    : `/matrix ${input.trim()}`;

  const { content, usage } = await callLLM({
    apiKey,
    model,
    system,
    user: userMessage,
    history,
    maxTokens: 3500,
  }, llmRuntime);

  const finalized = await finalizeGeneratedOutput({
    content,
    usage,
    evaluate: (candidate) =>
      evaluatePeelOutput(candidate, {
        minPeels: 4,
        maxPeels: 4,
        extraIssues: matrixContractIssues,
      }),
    repair: ({ content: failedContent, issues }) =>
      callLLM({
        apiKey,
        model,
        system,
        user: buildRepairInstruction(issues),
        history: [
          ...history,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: failedContent },
        ],
        maxTokens: 3500,
      }, llmRuntime),
  });

  const shared = {
    topic: {
      id: classification.topicId,
      score: classification.score,
      matchedKeywords: classification.matchedKeywords,
    },
    reductionModel: {
      id: reductionModel.id,
      name: reductionModel.name,
      score: reductionModel.score,
    },
  };

  if (!finalized.ok) {
    return { ...finalized, ...shared, entities: [] };
  }

  await memoryStore.recordResult({ userId }, {
    topicId: classification.topicId,
    validation: finalized.validation,
    command: 'matrix',
    source: 'agent',
  });

  const entities = (finalized.parsed.peels || []).flatMap((p) =>
    detectEntities([p.E2].join(' '))
  );

  return {
    ...finalized,
    ...shared,
    entities,
  };
}
