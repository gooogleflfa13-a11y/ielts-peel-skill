import { callLLM } from '../utils/llmClient.js';
import { buildPeelPrompt } from '../prompts/peelPrompt.js';
import { retrieveTopic } from '../knowledge/topicRetriever.js';
import { parsePeelOutput, parseLooseLines } from '../parsing/peelParser.js';
import { validatePeels, detectEntities } from '../evaluation/validator.js';
import { buildStructuralFeedback, STRUCTURAL_FEEDBACK_DISCLAIMER } from '../evaluation/structuralFeedback.js';
import { sanitizeUserInput, wrapAsTaskPayload } from '../utils/sanitize.js';
import { MAX_INPUT_CHARS } from '../utils/constants.js';
import { createNullAttemptStore } from './attempts.js';

/**
 * Phase 2 Feature lane - learn command.
 *
 * Five modes, all routed through the unified pipeline:
 *  - practice: student writes first, then structural feedback. Records an attempt.
 *  - hint:      scaffolding questions only - never the answer.
 *  - model:     generates a PEEL via the LLM, tagged as a model answer.
 *  - compare:   student PEEL + AI PEEL side by side; student gets feedback.
 *  - revise:    loads a prior attempt and re-scores it (append-only revisions).
 *
 * Criterion feedback (Task 3, Core lane) is not wired here yet; practice and
 * revise currently return structural PEEL feedback. Integration upgrades the
 * feedback to criterion dimensions (TR/CC/LR/GRA for writing, FC/LR/GRA/PR for
 * speaking) once the Core criterion module lands.
 */

const MODES = new Set(['practice', 'hint', 'model', 'compare', 'revise']);

const MODEL_DISCLAIMER =
  'Model answer for reference only. Not an official IELTS assessment or band estimate.';
const HINT_DISCLAIMER =
  'Scaffolding guidance only. Not an official IELTS assessment or band estimate.';

function invalidRequest(message) {
  return Object.assign(new Error(message), {
    code: 'INVALID_REQUEST',
    status: 400,
    retryable: false,
  });
}

function resolveTopic(input) {
  const { classification } = retrieveTopic(input);
  return {
    id: classification?.topicId || null,
    score: classification?.score,
    matchedKeywords: classification?.matchedKeywords,
  };
}

function scoreText(text) {
  let parsed = parsePeelOutput(text);
  let peels = parsed.peels;

  if (peels.length === 0) {
    const looseLineCount = String(text || '')
      .split(/\n/)
      .filter((line) => line.trim()).length;
    const loose = looseLineCount === 4 ? parseLooseLines(text) : null;
    if (loose) {
      peels = [loose];
      parsed = { ok: true, peels, meta: null, model: null, raw: text };
    }
  }

  const validation = validatePeels(peels);
  const review = buildStructuralFeedback(parsed, validation);
  return { parsed, validation, ...review };
}

function buildHintQuestions(input, skill) {
  const scope = skill === 'speaking' ? 'Speaking Part 3' : 'Writing Task 2';
  return (
    `Scaffolding questions for ${scope} - answer these yourself before reading any model answer.\n\n` +
    `1. Point: In one sentence, what is your overall verdict on the question: "${input.slice(0, 120)}"?\n` +
    `2. Explanation: What single mechanism causes this - how does A lead to B without naming concrete people or places yet?\n` +
    `3. Example: Which concrete person, place, object, or observable action proves your mechanism?\n` +
    `4. Link: How does your example circle back to your original point in one closing sentence?\n\n` +
    `Draft your own four sentences first. Then run /learn practice with your draft to get feedback.`
  );
}

async function generateModelPeel({ input, skill, apiKey, model, history }, llmRuntime) {
  const { classification, knowledge: topicKnowledge } = retrieveTopic(input);
  const system = buildPeelPrompt({
    topicKnowledge,
    topicId: classification?.topicId,
    skill: skill === 'speaking' ? 'speaking' : 'writing',
  });
  const userMessage = input.trim().startsWith('/learn')
    ? input.trim().replace(/^\/learn\s+\S+\s*/, '')
    : input.trim();
  const wrapped = wrapAsTaskPayload(userMessage);

  const { content, usage } = await callLLM(
    {
      apiKey,
      model,
      system,
      user: wrapped,
      history,
      temperature: 0.3,
      maxTokens: 2500,
    },
    llmRuntime
  );

  const parsed = parsePeelOutput(content);
  const entities = (parsed.peels || []).flatMap((p) =>
    detectEntities([p.P, p.E1, p.E2, p.L].join(' '))
  );
  return { content, parsed, usage, entities, topic: resolveTopic(input) };
}

export async function runLearnSkill(
  {
    input = '',
    mode = 'practice',
    studentText = '',
    attemptId = null,
    skill = 'writing',
    apiKey,
    model = 'gpt-4o-mini',
    history = [],
    userId = 'default',
    memoryStore,
  } = {},
  { attemptStore = createNullAttemptStore(), llmRuntime } = {}
) {
  if (!MODES.has(mode)) {
    throw invalidRequest(`Unknown learn mode "${mode}". Expected one of: ${[...MODES].join(', ')}.`);
  }

  const { clean: safeInput } = sanitizeUserInput(input, { maxLen: MAX_INPUT_CHARS });
  const { clean: safeStudent } = sanitizeUserInput(studentText, { maxLen: MAX_INPUT_CHARS });
  const resolvedSkill = skill === 'speaking' ? 'speaking' : 'writing';
  const topic = resolveTopic(safeInput);

  if (mode === 'practice') {
    if (!safeStudent.trim()) {
      throw invalidRequest('practice mode requires studentText before feedback can be produced.');
    }
    const { parsed, validation, feedback, disclaimer } = scoreText(safeStudent);
    const record = attemptStore.createAttempt(
      { userId },
      {
        skill: resolvedSkill,
        question: safeInput,
        studentText: safeStudent,
        feedback,
      }
    );
    return {
      status: 'success',
      content: safeStudent,
      parsed,
      validation,
      feedback,
      disclaimer,
      mode: 'practice',
      topic,
      retries: 0,
      entities: [],
      attemptId: record?.id || null,
    };
  }

  if (mode === 'hint') {
    const content = buildHintQuestions(safeInput, resolvedSkill);
    return {
      status: 'success',
      content,
      parsed: null,
      validation: { passed: true },
      feedback: null,
      disclaimer: HINT_DISCLAIMER,
      mode: 'hint',
      topic,
      retries: 0,
      entities: [],
    };
  }

  if (mode === 'model') {
    if (!apiKey || !String(apiKey).trim()) {
      throw invalidRequest('model mode requires an api key to generate a model answer.');
    }
    const generated = await generateModelPeel(
      { input: safeInput, skill: resolvedSkill, apiKey, model, history },
      llmRuntime
    );
    return {
      status: 'success',
      content: generated.content,
      parsed: generated.parsed,
      validation: { passed: generated.parsed.ok },
      feedback: null,
      disclaimer: MODEL_DISCLAIMER,
      mode: 'model',
      topic: generated.topic,
      retries: 0,
      entities: generated.entities,
      isModel: true,
    };
  }

  if (mode === 'compare') {
    if (!safeStudent.trim()) {
      throw invalidRequest('compare mode requires studentText to compare against the model.');
    }
    if (!apiKey || !String(apiKey).trim()) {
      throw invalidRequest('compare mode requires an api key to generate the model answer.');
    }
    const { parsed: studentParsed, validation, feedback, disclaimer } = scoreText(safeStudent);
    const generated = await generateModelPeel(
      { input: safeInput, skill: resolvedSkill, apiKey, model, history },
      llmRuntime
    );
    const content =
      `STUDENT PEEL:\n${safeStudent}\n\n` +
      `MODEL PEEL:\n${generated.content}`;
    const record = attemptStore.createAttempt(
      { userId },
      {
        skill: resolvedSkill,
        question: safeInput,
        studentText: safeStudent,
        feedback,
      }
    );
    return {
      status: 'success',
      content,
      parsed: generated.parsed,
      validation: generated.parsed.ok ? { passed: true } : validation,
      feedback,
      disclaimer,
      mode: 'compare',
      topic: generated.topic,
      retries: 0,
      entities: generated.entities,
      isModel: true,
      attemptId: record?.id || null,
    };
  }

  // mode === 'revise'
  if (!attemptId) {
    throw invalidRequest('revise mode requires an attemptId of a prior attempt to re-score.');
  }
  const prior = attemptStore.loadAttempt({ userId }, attemptId);
  if (!prior) {
    throw invalidRequest(`revise mode could not find prior attempt "${attemptId}".`);
  }
  const { parsed, validation, feedback, disclaimer } = scoreText(prior.studentText);
  attemptStore.appendRevision({ userId }, attemptId, { feedback });
  const stored = attemptStore.loadAttempt({ userId }, attemptId);
  return {
    status: 'success',
    content: prior.studentText,
    parsed,
    validation,
    feedback,
    disclaimer,
    mode: 'revise',
    topic: resolveTopic(prior.question || safeInput),
    retries: 0,
    entities: [],
    attemptId,
    revisions: stored?.revisions || [],
  };
}
