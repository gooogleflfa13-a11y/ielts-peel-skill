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
import { determineWizardState, wizardStatePolicy } from '../wizard/wizardState.js';

export async function runWizardSkill({
  input,
  history = [],
  apiKey,
  baseUrl,
  model,
  userId = 'default',
  phase = null,
  memoryStore = createNullMemoryStore(),
}, { llmRuntime } = {}) {
  const { clean: safeInput } = sanitizeUserInput(input, {
    maxLen: MAX_INPUT_CHARS,
  });
  const { classification, knowledge: topicKnowledge } = retrieveTopic(safeInput);

  const wizardState = determineWizardState({ history, phase });
  const policy = wizardStatePolicy(wizardState);

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

  const evaluate = policy.expectsScripts
    ? (candidate) =>
        evaluatePeelOutput(candidate, {
          minPeels: 3,
          maxPeels: 4,
          extraIssues: wizardScriptIssues,
          prompt: safeInput,
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

  // Persist only when the state machine allows it (READY_TO_GENERATE).
  if (policy.persists) {
    const fuel = sanitizeFuelText(safeInput, { maxLen: 300 });
    if (fuel) {
      await memoryStore.addE2Fuel({ userId }, {
        topic: classification.topicId || 'General',
        entity: fuel.slice(0, 120),
        sourceQuestion: 'wizard-turn',
        sourceAnswer: fuel.slice(0, 200),
      });
    }

    await memoryStore.recordResult({ userId }, {
      topicId: classification.topicId,
      validation: finalized.validation,
      command: 'wizard',
      source: 'agent',
    });
  }

  return {
    ...finalized,
    topic,
    entities: [],
  };
}
