import { runPeelSkill, buildUserContextBlock } from '../skills/peelSkill.js';
import { runMatrixSkill } from '../skills/matrixSkill.js';
import { runWizardSkill } from '../skills/wizardSkill.js';
import { runScoreSkill } from '../skills/scoreSkill.js';
import { runBankSkill } from '../skills/bankSkill.js';
import { runLearnSkill } from '../learner/learnSkill.js';
import { createNullMemoryStore } from '../memory/memoryStore.js';
import { retrieveTopic } from '../knowledge/topicRetriever.js';
import { buildPeelPrompt } from '../prompts/peelPrompt.js';
import { detectEntities } from '../evaluation/validator.js';
import {
  buildRepairInstruction,
  createQualityError,
  evaluatePeelOutput,
  finalizeGeneratedOutput,
} from '../evaluation/outputQuality.js';
import { sanitizeUserInput, wrapAsTaskPayload } from '../utils/sanitize.js';
import { MAX_INPUT_CHARS } from '../utils/constants.js';
import { callLLM, handleLLMError, streamLLM } from '../utils/llmClient.js';
import { log } from '../utils/logger.js';
import { recordMetric } from '../utils/metrics.js';
import { validateRequest } from '../schemas/request.js';
import { validateResponse } from '../schemas/response.js';

function invalidRequest(issues) {
  return Object.assign(new Error('The request is invalid.'), {
    code: 'INVALID_REQUEST',
    status: 400,
    retryable: false,
    issues,
  });
}

function invalidResponse(issues) {
  return Object.assign(new Error('Command result violated its response contract.'), {
    code: 'INVALID_RESPONSE',
    status: 500,
    retryable: false,
    issues,
  });
}

function providerRuntime(options, signal) {
  const runtime = options.providerRuntime || options.llmRuntime;
  if (!signal) return runtime;
  return { ...runtime, signal };
}

async function dispatchCommand(request, options) {
  const runtime = providerRuntime(options, options.signal);
  switch (request.command) {
    case 'peel':
      return runPeelSkill(request, { llmRuntime: runtime });
    case 'matrix':
      return runMatrixSkill(request, { llmRuntime: runtime });
    case 'wizard':
      return runWizardSkill(request, { llmRuntime: runtime });
    case 'score':
      return runScoreSkill(request);
    case 'bank':
      return runBankSkill({
        ...request,
        enablePrivateQuestionBank: options.enablePrivateQuestionBank,
      });
    case 'learn':
      return runLearnSkill(request, {
        attemptStore: options.attemptStore,
        llmRuntime: runtime,
      });
    default:
      throw invalidRequest([{ field: 'command', message: 'Unknown command.' }]);
  }
}

async function streamPeel(request, options) {
  const runtime = providerRuntime(options, options.signal);
  const { clean } = sanitizeUserInput(request.input, { maxLen: MAX_INPUT_CHARS });
  const { classification, knowledge: topicKnowledge } = retrieveTopic(clean);
  const memoryContext = { userId: request.userId };
  const userFuel = await request.memoryStore.getRelevantFuel(
    memoryContext,
    classification?.topicId
  );
  const system = buildPeelPrompt({
    topicKnowledge,
    topicId: classification?.topicId,
  });
  const userMessage = clean.trim().startsWith('/peel')
    ? clean.trim()
    : `/peel ${clean.trim()}`;
  const wrappedUser = wrapAsTaskPayload(userMessage) + buildUserContextBlock(userFuel);
  const messages = [
    { role: 'system', content: system },
    ...request.history,
    { role: 'user', content: wrappedUser },
  ];

  let content = '';
  for await (const chunk of streamLLM({
    apiKey: request.apiKey,
    model: request.model,
    messages,
    temperature: 0.3,
    maxTokens: 2500,
  }, runtime)) {
    content += chunk;
  }

  const finalized = await finalizeGeneratedOutput({
    content,
    usage: null,
    evaluate: (candidate) =>
      evaluatePeelOutput(candidate, { minPeels: 1, maxPeels: 1 }),
    repair: ({ content: failedContent, issues }) =>
      callLLM({
        apiKey: request.apiKey,
        model: request.model,
        system,
        user: buildRepairInstruction(issues),
        history: [
          ...request.history,
          { role: 'user', content: wrappedUser },
          { role: 'assistant', content: failedContent },
        ],
      }, runtime),
  });

  const topic = {
    id: classification?.topicId,
    score: classification?.score,
    matchedKeywords: classification?.matchedKeywords,
  };
  if (!finalized.ok) {
    return { ...finalized, topic, entities: [] };
  }

  await request.memoryStore.recordResult(memoryContext, {
    topicId: classification?.topicId,
    validation: finalized.validation,
    command: 'peel',
    source: 'agent',
  });
  const entities = (finalized.parsed.peels || []).flatMap((peel) =>
    detectEntities([peel.P, peel.E1, peel.E2, peel.L].join(' '))
  );

  return { ...finalized, topic, entities };
}

async function finalizeResult({ rawResult, request, warnings, started }) {
  const latencyMs = Date.now() - started;
  const tokens = rawResult.usage?.total_tokens || 0;
  const passed =
    rawResult.status !== 'quality_failed' &&
    (rawResult.validation?.passed ?? true);

  recordMetric({
    topicId: rawResult.topic?.id,
    tokens,
    latency: latencyMs,
    passed,
    command: request.command,
  });
  log('INFO', `${request.command}.generated`, {
    topic: rawResult.topic?.id || null,
    tokens,
    validationPassed: passed,
    retries: rawResult.retries || 0,
    latencyMs,
  });

  let result;
  if (rawResult.status === 'quality_failed') {
    result = {
      ok: false,
      status: 'quality_failed',
      code: 'QUALITY_FAILED',
      message: rawResult.message,
      command: request.command,
      content: null,
      parsed: rawResult.parsed,
      validation: rawResult.validation,
      issues: rawResult.issues,
      topic: rawResult.topic || null,
      entities: rawResult.entities || [],
      reductionModel: rawResult.reductionModel || null,
      feedback: rawResult.feedback,
      disclaimer: rawResult.disclaimer,
      retries: rawResult.retries || 0,
      latencyMs,
      bank: rawResult.bank || null,
    };
  } else {
    const weak = await request.memoryStore.getWeaknessReport({
      userId: request.userId,
    });
    result = {
      ok: true,
      status: 'success',
      command: request.command,
      model: request.model,
      content: rawResult.content,
      parsed: rawResult.parsed,
      usage: rawResult.usage || null,
      topic: rawResult.topic || null,
      validation: rawResult.validation,
      entities: rawResult.entities || [],
      feedback: rawResult.feedback,
      disclaimer: rawResult.disclaimer,
      reductionModel: rawResult.reductionModel || null,
      retries: rawResult.retries || 0,
      weak: weak?.suggestion || null,
      latencyMs,
      bank: rawResult.bank || null,
      sanitizeWarnings: warnings.length ? warnings : undefined,
      ...(request.command === 'learn'
        ? {
            criterionFeedback: rawResult.criterionFeedback ?? null,
            mode: rawResult.mode ?? null,
            comparison: rawResult.comparison ?? null,
            revisionDiff: rawResult.revisionDiff ?? null,
            resolvedIssues: rawResult.resolvedIssues ?? null,
            unresolvedIssues: rawResult.unresolvedIssues ?? null,
            introducedIssues: rawResult.introducedIssues ?? null,
            revisions: rawResult.revisions ?? null,
            isModel: rawResult.isModel ?? null,
          }
        : {}),
    };
  }

  const responseValidation = validateResponse(request.command, result);
  if (!responseValidation.ok) throw invalidResponse(responseValidation.issues);
  return result;
}

function buildEvents(result, stream) {
  if (!stream) return [{ type: 'complete', result }];
  if (result.status === 'quality_failed') {
    return [{ type: 'error', error: createQualityError(result) }];
  }
  return [
    ...(result.content ? [{ type: 'chunk', content: result.content }] : []),
    { type: 'complete', result },
  ];
}

export async function executeCommand(request = {}, options = {}) {
  const started = Date.now();
  const command = String(request.command || 'peel').toLowerCase();
  const {
    baseUrl: _requestControlledBaseUrl,
    aiScore: _disabledAiScore,
    ...schemaRequest
  } = request;
  const validation = validateRequest(command, schemaRequest);
  if (!validation.ok) throw invalidRequest(validation.issues);

  const memoryStore = request.memoryStore || createNullMemoryStore();
  const normalizedRequest = {
    ...validation.value,
    memoryStore,
  };
  const executionOptions = {
    ...options,
    signal: options.signal || request.signal,
  };

  try {
    const { clean, warnings } = sanitizeUserInput(normalizedRequest.input, {
      maxLen: MAX_INPUT_CHARS,
    });
    normalizedRequest.input = clean;
    if (warnings.length) {
      log('WARN', 'input.sanitized', { warnings, command });
    }

    const rawResult =
      options.stream && command === 'peel'
        ? await streamPeel(normalizedRequest, executionOptions)
        : await dispatchCommand(normalizedRequest, executionOptions);
    const result = await finalizeResult({
      rawResult,
      request: normalizedRequest,
      warnings,
      started,
    });
    const events = buildEvents(result, Boolean(options.stream));
    for (const event of events) options.onEvent?.(event);
    return { result, events };
  } catch (error) {
    if (
      executionOptions.signal?.aborted ||
      error?.name === 'AbortError' ||
      error?.code === 'INVALID_REQUEST' ||
      error?.code === 'INVALID_RESPONSE'
    ) {
      throw error;
    }
    log('ERROR', `${command}.failed`, {
      message: error?.message,
      status: error?.status,
    });
    const status = error?.status || error?.response?.status || 500;
    throw Object.assign(new Error(handleLLMError(error)), {
      status: status >= 400 && status < 600 ? status : 500,
      code: error?.code || 'UPSTREAM_ERROR',
      retryable: status >= 500 || status === 429,
    });
  }
}
