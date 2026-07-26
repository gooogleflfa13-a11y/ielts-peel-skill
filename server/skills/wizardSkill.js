import { buildWizardPrompt } from '../prompts/wizardPrompt.js';
import { callLLM } from '../utils/llmClient.js';
import { retrieveTopic } from '../knowledge/topicRetriever.js';
import { createNullMemoryStore } from '../memory/memoryStore.js';
import { sanitizeFuelText, sanitizeUserInput, wrapAsTaskPayload } from '../utils/sanitize.js';
import { MAX_INPUT_CHARS } from '../utils/constants.js';
import {
  buildRepairInstruction,
  evaluatePeelOutput,
  evaluateWizardQuestions,
  finalizeGeneratedOutput,
  wizardScriptIssues,
} from '../evaluation/outputQuality.js';

export async function runWizardSkill({
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

  const system = buildWizardPrompt({
    topicKnowledge,
    topicId: classification.topicId,
  });

  const userMessage =
    !safeInput.trim() || safeInput.trim() === '/wizard'
      ? '/wizard'
      : safeInput.trim().startsWith('/wizard')
        ? safeInput.trim()
        : `/wizard ${safeInput.trim()}`;

  const { content, usage } = await callLLM({
    apiKey,
    model,
    system,
    user: wrapAsTaskPayload(userMessage),
    history,
    maxTokens: 3500,
  }, llmRuntime);

  const expectsScripts = history.length > 0;
  const evaluate = expectsScripts
    ? (candidate) =>
        evaluatePeelOutput(candidate, {
          minPeels: 3,
          maxPeels: 4,
          extraIssues: wizardScriptIssues,
        })
    : evaluateWizardQuestions;
  const wrappedUser = wrapAsTaskPayload(userMessage);
  const finalized = await finalizeGeneratedOutput({
    content,
    usage,
    evaluate,
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
        maxTokens: 3500,
      }, llmRuntime),
  });

  const topic = {
    id: classification.topicId,
    score: classification.score,
    matchedKeywords: classification.matchedKeywords,
  };

  if (!finalized.ok) {
    return { ...finalized, topic, entities: [] };
  }

  // Store sanitized user answers as E2 fuel (no email/phone; max 300 chars)
  if (history.length > 0) {
    const fuel = sanitizeFuelText(safeInput, { maxLen: 300 });
    if (fuel) {
      await memoryStore.addE2Fuel({ userId }, {
        topic: classification.topicId || 'General',
        entity: fuel.slice(0, 120),
        sourceQuestion: 'wizard-turn',
        sourceAnswer: fuel.slice(0, 200),
      });
    }
  }

  await memoryStore.recordResult({ userId }, {
    topicId: classification.topicId,
    validation: finalized.validation,
    command: 'wizard',
    source: 'agent',
  });

  return {
    ...finalized,
    topic,
    entities: [],
  };
}
