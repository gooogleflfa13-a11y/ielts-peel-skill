import { runPeelSkill } from './skills/peelSkill.js';
import { runMatrixSkill } from './skills/matrixSkill.js';
import { runWizardSkill } from './skills/wizardSkill.js';
import { runScoreSkill } from './skills/scoreSkill.js';
import { runBankSkill } from './skills/bankSkill.js';
import { getWeaknessReport, getRelevantFuel, recordPeelResult } from './memory/userMemory.js';
import { log } from './utils/logger.js';
import { recordMetric } from './utils/metrics.js';
import { handleLLMError, callLLM, streamLLM } from './utils/llmClient.js';
import { retrieveTopic } from './knowledge/topicRetriever.js';
import { buildPeelPrompt } from './prompts/peelPrompt.js';
import { parsePeelOutput } from './parsing/peelParser.js';
import { validatePeels, detectEntities } from './evaluation/validator.js';
import {
  sanitizeUserInput,
  wrapAsTaskPayload,
} from './utils/sanitize.js';
import { MAX_INPUT_CHARS } from './utils/constants.js';

/**
 * Central dispatcher for /peel /matrix /wizard /score /bank
 */
export async function runCommand({
  command,
  input,
  history = [],
  apiKey,
  baseUrl,
  model,
  userId = 'default',
  aiScore = false,
}) {
  const started = Date.now();
  const cmd = (command || 'peel').toLowerCase();

  try {
    const { clean, warnings } = sanitizeUserInput(input, {
      maxLen: MAX_INPUT_CHARS,
    });
    if (warnings.length) {
      log('WARN', 'input.sanitized', { warnings, command: cmd });
    }

    let result;

    switch (cmd) {
      case 'peel':
        result = await runPeelSkill({
          input: clean,
          history,
          apiKey,
          baseUrl,
          model,
          userId,
        });
        break;
      case 'matrix':
        result = await runMatrixSkill({
          input: clean,
          history,
          apiKey,
          baseUrl,
          model,
          userId,
        });
        break;
      case 'wizard':
        result = await runWizardSkill({
          input: clean,
          history,
          apiKey,
          baseUrl,
          model,
          userId,
        });
        break;
      case 'score':
        result = await runScoreSkill({
          input: clean,
          apiKey,
          baseUrl,
          model,
          aiScore,
        });
        break;
      case 'bank':
        result = await runBankSkill({
          input: clean,
          history,
          apiKey,
          baseUrl,
          model,
          userId,
        });
        break;
      default:
        throw Object.assign(new Error(`Unknown command: ${cmd}`), {
          status: 400,
        });
    }

    const latency = Date.now() - started;
    const tokens = result.usage?.total_tokens || 0;
    const passed = result.validation?.passed ?? true;

    recordMetric({
      topicId: result.topic?.id,
      tokens,
      latency,
      passed,
      command: cmd,
    });

    log('INFO', `${cmd}.generated`, {
      topic: result.topic?.id || null,
      tokens,
      validationPassed: passed,
      retries: result.retries || 0,
      latencyMs: latency,
    });

    const weak = getWeaknessReport(userId);

    return {
      ok: true,
      command: cmd,
      model,
      content: result.content,
      parsed: result.parsed,
      usage: result.usage || null,
      topic: result.topic,
      validation: result.validation,
      entities: result.entities || [],
      semantic: result.semantic || null,
      reductionModel: result.reductionModel || null,
      retries: result.retries || 0,
      weak: weak?.suggestion || null,
      latencyMs: latency,
      bank: result.bank || null,
      sanitizeWarnings: warnings.length ? warnings : undefined,
    };
  } catch (err) {
    log('ERROR', `${cmd}.failed`, {
      message: err?.message,
      status: err?.status,
    });
    const message = handleLLMError(err);
    const status = err?.status || err?.response?.status || 500;
    const e = new Error(message);
    e.status = status >= 400 && status < 600 ? status : 500;
    e.code = err?.code || 'UPSTREAM_ERROR';
    e.retryable = status >= 500 || status === 429;
    throw e;
  }
}

/**
 * Streaming path.
 * - peel: true token stream via streamLLM
 * - other commands: fall back to runCommand then emit one complete event
 *   (documented: only peel streams tokens)
 */
export async function runCommandStream({
  command,
  input,
  history = [],
  apiKey,
  baseUrl,
  model,
  userId = 'default',
  aiScore = false,
  onChunk,
  onComplete,
  onError,
}) {
  const started = Date.now();
  const cmd = (command || 'peel').toLowerCase();

  try {
    if (cmd !== 'peel') {
      const result = await runCommand({
        command,
        input,
        history,
        apiKey,
        baseUrl,
        model,
        userId,
        aiScore,
      });
      // optional single "chunk" of full body for UI parity
      if (result.content) onChunk?.(result.content);
      onComplete?.(result);
      return;
    }

    const { clean } = sanitizeUserInput(input, { maxLen: MAX_INPUT_CHARS });
    const { classification, knowledge: topicKnowledge } = retrieveTopic(clean);

    const userFuel = getRelevantFuel(userId, classification?.topicId);
    const fuelHint =
      userFuel.length > 0
        ? `\n[USER E2 FUEL — prefer these personal entities]: ${userFuel
            .map((f) => f.entity)
            .join(' | ')}\n`
        : '';

    const system = buildPeelPrompt({
      topicKnowledge,
      topicId: classification?.topicId,
      fuelHint,
    });

    const userMessage = clean.trim().startsWith('/peel')
      ? clean.trim()
      : `/peel ${clean.trim()}`;
    const wrappedUser = wrapAsTaskPayload(userMessage);

    const baseMessages = [
      { role: 'system', content: system },
      ...history
        .filter(
          (m) =>
            m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string'
        )
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: wrappedUser },
    ];

    let fullContent = '';
    let retries = 0;

    for await (const chunk of streamLLM({
      apiKey,
      baseUrl,
      model,
      messages: baseMessages,
      temperature: 0.3,
      maxTokens: 2500,
    })) {
      fullContent += chunk;
      onChunk?.(chunk);
    }

    let parsed = parsePeelOutput(fullContent);
    let validation = validatePeels(parsed.peels);

    if (
      !validation.passed &&
      validation.allWarnings.length > 0 &&
      parsed.peels.length > 0
    ) {
      retries = 1;
      const failedAttempt = fullContent;
      const correctionHint = `Your previous output had these quality issues:\n${validation.allWarnings
        .map((w, i) => `${i + 1}. ${w}`)
        .join(
          '\n'
        )}\n\nPLEASE REGENERATE. Fix all issues. Keep exact [P][E1][E2][L] format.`;

      // Non-stream correction for reliability; emit as one chunk
      const corrected = await callLLM({
        apiKey,
        baseUrl,
        model,
        system,
        user: correctionHint,
        history: [
          ...history,
          { role: 'user', content: wrappedUser },
          { role: 'assistant', content: failedAttempt },
        ],
      });
      fullContent = corrected.content || '';
      onChunk?.('\n\n' + fullContent);
      parsed = parsePeelOutput(fullContent);
      validation = validatePeels(parsed.peels);
    }

    recordPeelResult(userId, {
      topicId: classification?.topicId,
      validation,
      command: 'peel',
    });

    const entities = (parsed.peels || []).flatMap((p) =>
      detectEntities([p.P, p.E1, p.E2, p.L].join(' '))
    );
    const weak = getWeaknessReport(userId);
    const latency = Date.now() - started;

    recordMetric({
      topicId: classification?.topicId,
      tokens: 0,
      latency,
      passed: validation.passed,
      command: cmd,
    });

    onComplete?.({
      ok: true,
      command: cmd,
      model,
      content: fullContent,
      parsed,
      usage: null,
      topic: {
        id: classification?.topicId,
        score: classification?.score,
        matchedKeywords: classification?.matchedKeywords,
      },
      validation,
      entities,
      semantic: null,
      reductionModel: null,
      retries,
      weak: weak?.suggestion || null,
      latencyMs: latency,
      streamNote: 'Token streaming is peel-only; other commands complete in one shot.',
    });
  } catch (err) {
    log('ERROR', `${cmd}.failed`, {
      message: err?.message,
      status: err?.status,
    });
    const message = handleLLMError(err);
    onError?.(Object.assign(new Error(message), { code: 'STREAM_ERROR', retryable: true }));
  }
}
