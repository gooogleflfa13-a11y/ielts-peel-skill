import { runPeelSkill } from './skills/peelSkill.js';
import { runMatrixSkill } from './skills/matrixSkill.js';
import { runWizardSkill } from './skills/wizardSkill.js';
import { runScoreSkill } from './skills/scoreSkill.js';
import { runBankSkill } from './skills/bankSkill.js';
import { getWeaknessReport } from './memory/userMemory.js';
import { log } from './utils/logger.js';
import { recordPeel } from './utils/metrics.js';
import { handleLLMError } from './utils/llmClient.js';
import { callLLM } from './utils/llmClient.js';

/**
 * Central dispatcher for /peel /matrix /wizard /score
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
    let result;

    switch (cmd) {
      case 'peel':
        result = await runPeelSkill({
          input,
          history,
          apiKey,
          baseUrl,
          model,
          userId,
        });
        break;
      case 'matrix':
        result = await runMatrixSkill({
          input,
          history,
          apiKey,
          baseUrl,
          model,
          userId,
        });
        break;
      case 'wizard':
        result = await runWizardSkill({
          input,
          history,
          apiKey,
          baseUrl,
          model,
          userId,
        });
        break;
      case 'score':
        result = await runScoreSkill({
          input,
          apiKey,
          baseUrl,
          model,
          aiScore,
        });
        break;
      case 'bank':
        result = await runBankSkill({
          input,
          history,
          apiKey,
          baseUrl,
          model,
          userId,
        });
        break;
      default:
        throw Object.assign(new Error(`Unknown command: ${cmd}`), { status: 400 });
    }

    const latency = Date.now() - started;
    const tokens = result.usage?.total_tokens || 0;
    const passed = result.validation?.passed ?? true;

    recordPeel({
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
    throw e;
  }
}

/**
 * Streaming version — yields chunks via callbacks
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
      // For non-peel commands, fall back to non-streaming
      const result = await runCommand({ command, input, history, apiKey, baseUrl, model, userId, aiScore });
      onComplete?.(result);
      return;
    }

    const { classification, knowledge: topicKnowledge } = await import('./knowledge/topicRetriever.js').then(m => m.retrieveTopic(input));

    const { getRelevantFuel } = await import('./memory/userMemory.js');
    const userFuel = getRelevantFuel(userId, classification?.topicId);
    const fuelHint = userFuel.length > 0
      ? `\n[USER E2 FUEL — prefer these personal entities]: ${userFuel.map(f => f.entity).join(' | ')}\n`
      : '';

    const { buildPeelPrompt } = await import('./prompts/peelPrompt.js');
    const system = buildPeelPrompt({ topicKnowledge, topicId: classification?.topicId, fuelHint });

    const userMessage = input.trim().startsWith('/peel') ? input.trim() : `/peel ${input.trim()}`;

    const messages = [
      { role: 'system', content: system },
      ...history.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-12).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ];

    const { callLLMStream } = await import('./utils/llmClient.js');

    let fullContent = '';
    let retries = 0;
    let finalParsed = null;
    let finalValidation = null;

    for await (const chunk of callLLMStream({ apiKey, baseUrl, model, messages, temperature: 0.3, maxTokens: 2500 })) {
      fullContent += chunk;
      onChunk?.(chunk);
    }

    const { parsePeelOutput } = await import('./parsing/peelParser.js');
    const { validatePeels } = await import('./evaluation/validator.js');

    let parsed = parsePeelOutput(fullContent);
    let validation = validatePeels(parsed.peels);

    if (!validation.passed && validation.allWarnings.length > 0 && parsed.peels.length > 0 && retries === 0) {
      retries = 1;
      const correctionHint = `Your previous output had these quality issues:\n${validation.allWarnings.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n\nPLEASE REGENERATE. Fix all issues. Keep exact [P][E1][E2][L] format.`;

      fullContent = '';
      const correctedMessages = [...messages, { role: 'assistant', content: fullContent }, { role: 'user', content: correctionHint }];

      for await (const chunk of callLLMStream({ apiKey, baseUrl, model, messages: correctedMessages, temperature: 0.3, maxTokens: 2500 })) {
        fullContent += chunk;
        onChunk?.(chunk);
      }

      parsed = parsePeelOutput(fullContent);
      validation = validatePeels(parsed.peels);
    }

    const { recordPeelResult } = await import('./memory/userMemory.js');
    recordPeelResult(userId, { topicId: classification?.topicId, validation, command: 'peel' });

    const { detectEntities } = await import('./evaluation/validator.js');
    const { getWeaknessReport } = await import('./memory/userMemory.js');
    const { recordPeel } = await import('./utils/metrics.js');

    const entities = (parsed.peels || []).flatMap(p => detectEntities([p.P, p.E1, p.E2, p.L].join(' ')));
    const weak = getWeaknessReport(userId);
    const latency = Date.now() - started;
    const tokens = 0; // Streaming doesn't return usage easily

    recordPeel({ topicId: classification?.topicId, tokens, latency, passed: validation.passed, command: cmd });

    const result = {
      ok: true,
      command: cmd,
      model,
      content: fullContent,
      parsed,
      usage: null,
      topic: { id: classification?.topicId, score: classification?.score, matchedKeywords: classification?.matchedKeywords },
      validation,
      entities,
      semantic: null,
      reductionModel: null,
      retries,
      weak: weak?.suggestion || null,
      latencyMs: latency,
    };

    onComplete?.(result);
  } catch (err) {
    log('ERROR', `${cmd}.failed`, { message: err?.message, status: err?.status });
    const { handleLLMError } = await import('./utils/llmClient.js');
    const message = handleLLMError(err);
    const status = err?.status || err?.response?.status || 500;
    onError?.(new Error(message));
  }
}
