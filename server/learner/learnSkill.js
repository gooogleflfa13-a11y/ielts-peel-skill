import { callLLM } from '../utils/llmClient.js';
import { buildPeelPrompt } from '../prompts/peelPrompt.js';
import { retrieveTopic } from '../knowledge/topicRetriever.js';
import { parsePeelOutput, parseLooseLines } from '../parsing/peelParser.js';
import { validatePeels, detectEntities } from '../evaluation/validator.js';
import { buildStructuralFeedback, STRUCTURAL_FEEDBACK_DISCLAIMER } from '../evaluation/structuralFeedback.js';
import { buildCriterionFeedback } from '../evaluation/criterionFeedback.js';
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
 * Structural checks are exposed as explicitly limited, criterion-aligned
 * proxies. They are not band predictions or complete IELTS assessments.
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

function scoreText(text, skill = 'writing') {
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
  const criterionFeedback = buildCriterionFeedback({
    skill,
    parseResult: parsed,
    validation,
  });
  return { parsed, validation, criterionFeedback, ...review };
}

function firstPeel(parsed) {
  return parsed?.peels?.[0] || { P: '', E1: '', E2: '', L: '' };
}

function buildLayerDiff(beforeParsed, afterParsed, beforeKey = 'before', afterKey = 'after') {
  const before = firstPeel(beforeParsed);
  const after = firstPeel(afterParsed);
  return Object.fromEntries(
    ['P', 'E1', 'E2', 'L'].map((layer) => [
      layer,
      {
        [beforeKey]: before[layer] || '',
        [afterKey]: after[layer] || '',
        changed: (before[layer] || '') !== (after[layer] || ''),
      },
    ])
  );
}

function issueId(issue) {
  return `${issue?.layer || 'ALL'}:${issue?.code || 'STRUCTURAL_ISSUE'}`;
}

function compareIssues(beforeFeedback, afterFeedback) {
  const beforeIssues = beforeFeedback?.issues || [];
  const afterIssues = afterFeedback?.issues || [];
  const beforeById = new Map(beforeIssues.map((issue) => [issueId(issue), issue]));
  const afterById = new Map(afterIssues.map((issue) => [issueId(issue), issue]));
  return {
    resolvedIssues: [...beforeById.entries()]
      .filter(([id]) => !afterById.has(id))
      .map(([id, issue]) => ({ id, ...issue })),
    unresolvedIssues: [...afterById.entries()]
      .filter(([id]) => beforeById.has(id))
      .map(([id, issue]) => ({ id, ...issue })),
    introducedIssues: [...afterById.entries()]
      .filter(([id]) => !beforeById.has(id))
      .map(([id, issue]) => ({ id, ...issue })),
  };
}

function latestDraft(attempt) {
  const latestRevision = attempt?.revisions?.at?.(-1);
  return {
    studentText: latestRevision?.studentText || attempt?.studentText || '',
    feedback: latestRevision?.feedback || attempt?.feedback || null,
  };
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
    const { parsed, validation, feedback, criterionFeedback } = scoreText(
      safeStudent,
      resolvedSkill
    );
    const record = attemptStore.createAttempt(
      { userId },
      {
        skill: resolvedSkill,
        question: safeInput,
        studentText: safeStudent,
        feedback,
        criterionFeedback,
      }
    );
    return {
      status: 'success',
      content: safeStudent,
      parsed,
      validation,
      feedback,
      criterionFeedback,
      disclaimer: criterionFeedback.disclaimer,
      mode: 'practice',
      skill: resolvedSkill,
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
      skill: resolvedSkill,
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
      skill: resolvedSkill,
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
    const {
      parsed: studentParsed,
      validation,
      feedback,
      criterionFeedback,
    } = scoreText(safeStudent, resolvedSkill);
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
        criterionFeedback,
      }
    );
    return {
      status: 'success',
      content,
      parsed: generated.parsed,
      validation: generated.parsed.ok ? { passed: true } : validation,
      feedback,
      criterionFeedback,
      disclaimer: criterionFeedback.disclaimer,
      mode: 'compare',
      skill: resolvedSkill,
      topic: generated.topic,
      retries: 0,
      entities: generated.entities,
      isModel: true,
      attemptId: record?.id || null,
      comparison: {
        layers: buildLayerDiff(studentParsed, generated.parsed, 'student', 'model'),
        studentIssues: feedback?.issues || [],
        summary: validation.passed
          ? 'The student response passed the available structural proxy checks; compare wording and development layer by layer.'
          : `${feedback?.issues?.length || 0} structural issue(s) were found in the student response; use the layer comparison to revise them.`,
      },
    };
  }

  // mode === 'revise'
  if (!attemptId) {
    throw invalidRequest('revise mode requires an attemptId of a prior attempt to re-score.');
  }
  if (!safeStudent.trim()) {
    throw invalidRequest('revise mode requires a newly edited studentText draft.');
  }
  const prior = attemptStore.loadAttempt({ userId }, attemptId);
  if (!prior) {
    throw invalidRequest(`revise mode could not find prior attempt "${attemptId}".`);
  }
  const previous = latestDraft(prior);
  const beforeScore = scoreText(previous.studentText, prior.skill || resolvedSkill);
  const {
    parsed,
    validation,
    feedback,
    criterionFeedback,
  } = scoreText(safeStudent, prior.skill || resolvedSkill);
  const issueChanges = compareIssues(previous.feedback || beforeScore.feedback, feedback);
  const revisionDiff = {
    layers: buildLayerDiff(beforeScore.parsed, parsed),
    ...issueChanges,
  };
  attemptStore.appendRevision({ userId }, attemptId, {
    studentText: safeStudent,
    feedback,
    criterionFeedback,
    validation,
    diff: revisionDiff,
  });
  const stored = attemptStore.loadAttempt({ userId }, attemptId);
  return {
    status: 'success',
    content: safeStudent,
    parsed,
    validation,
    feedback,
    criterionFeedback,
    disclaimer: criterionFeedback.disclaimer,
    mode: 'revise',
    skill: prior.skill || resolvedSkill,
    topic: resolveTopic(prior.question || safeInput),
    retries: 0,
    entities: [],
    attemptId,
    revisions: stored?.revisions || [],
    revisionDiff,
    ...issueChanges,
  };
}
