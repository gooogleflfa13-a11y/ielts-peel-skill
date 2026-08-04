#!/usr/bin/env node
/**
 * @ielts-peel/cli — command-line adapter for the deterministic PEEL engine.
 *
 * Commands (see contracts/commands.json):
 *   classify <prompt>            Topic classification (stage 1 of /peel, /matrix)
 *   review [opts] <peel-text>    Deterministic PEEL review (workflow: /review)
 *   review [opts] -              Read PEEL text from stdin
 *   generate <prompt>            Generate one validated PEEL via the LLM
 *                               (workflow: /peel; requires an API key)
 *   calibrate export [opts]      Export a blind-review batch (teacher calibration)
 *   calibrate import <files...>  Analyse teacher annotations (kappa, disputes)
 *
 * Options:
 *   --prompt <text>   Original question, enables input-aware checks (OFF_TOPIC)
 *   --skill <s>       'writing' (default) or 'speaking' — criterion proxy mapping
 *   --api-key <k>     LLM key for generate (falls back to PEEL_API_KEY / OPENAI_API_KEY)
 *   --model <m>       LLM model for generate (default gpt-4o-mini)
 *   --per-category <n> Max blind-review entries per category (calibrate export)
 *   --seed <n>        Deterministic shuffle seed (calibrate export, default 1)
 *
 * Environment: PROVIDER_BASE_URL (default https://api.openai.com/v1),
 * UPSTREAM_TIMEOUT_MS (default 30000) for generate.
 *
 * Always prints a single JSON object to stdout; exits 1 on unknown usage.
 * generate exits 1 when the output fails the quality gate, 2 on missing key;
 * calibrate import exits 1 when annotations are invalid.
 */
import { readFileSync } from 'node:fs';
import { classifyPrompt, reviewPeel } from '../../core/src/engine.js';
import { runPeelSkill } from '../../../server/skills/peelSkill.js';
import { exportBatch, readJsonl } from '../../../evals/calibration/sample.mjs';
import {
  buildCalibrationReport,
  writeCalibrationReport,
} from '../../../evals/calibration/annotations.mjs';

function usage() {
  console.error(
    [
      'Usage:',
      '  peel-hacker classify <prompt>',
      '  peel-hacker review [--prompt <prompt>] [--skill writing|speaking] <peel-text...>',
      '  peel-hacker review [--prompt <prompt>] -   (read PEEL text from stdin)',
      '  peel-hacker generate [--api-key <k>] [--model <m>] <prompt>',
      '  peel-hacker calibrate export [--per-category <n>] [--seed <n>]',
      '  peel-hacker calibrate import <annotation-file...>',
    ].join('\n')
  );
  process.exit(2);
}

function parseArgs(argv) {
  const options = {
    command: null,
    prompt: null,
    skill: 'writing',
    apiKey: null,
    model: null,
    perCategory: null,
    seed: 1,
    textParts: [],
  };
  let index = 0;
  while (index < argv.length) {
    const arg = argv[index];
    if (!options.command) {
      options.command = arg;
      index += 1;
      continue;
    }
    if (arg === '--prompt') {
      options.prompt = argv[index + 1];
      if (!options.prompt) usage();
      index += 2;
      continue;
    }
    if (arg === '--skill') {
      const value = argv[index + 1];
      if (value !== 'writing' && value !== 'speaking') usage();
      options.skill = value;
      index += 2;
      continue;
    }
    if (arg === '--api-key') {
      options.apiKey = argv[index + 1];
      if (!options.apiKey) usage();
      index += 2;
      continue;
    }
    if (arg === '--model') {
      options.model = argv[index + 1];
      if (!options.model) usage();
      index += 2;
      continue;
    }
    if (arg === '--per-category') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) usage();
      options.perCategory = value;
      index += 2;
      continue;
    }
    if (arg === '--seed') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value)) usage();
      options.seed = value;
      index += 2;
      continue;
    }
    options.textParts.push(arg);
    index += 1;
  }
  return options;
}

function readInput(options) {
  if (options.textParts.length === 0 || options.textParts.join(' ').trim() === '-') {
    return readFileSync(0, 'utf8');
  }
  return options.textParts.join(' ');
}

const options = parseArgs(process.argv.slice(2));

if (options.command === 'classify') {
  const prompt = options.textParts.join(' ');
  if (!prompt) usage();
  const { classification } = classifyPrompt(prompt);
  console.log(
    JSON.stringify(
      {
        topicId: classification.topicId,
        label: classification.label,
        score: classification.score,
        confidence: classification.confidence,
        matchedKeywords: classification.matchedKeywords,
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (options.command === 'review') {
  const text = readInput(options);
  if (!text.trim()) usage();
  const result = reviewPeel(text, { prompt: options.prompt, skill: options.skill });
  console.log(
    JSON.stringify(
      {
        ok: result.validation.passed,
        checks: result.validation.checks,
        issues: result.feedback.issues || [],
        status: result.feedback.status,
        disclaimer: result.feedback.disclaimer,
        criterionFeedback: result.criterionFeedback,
      },
      null,
      2
    )
  );
  process.exit(result.validation.passed ? 0 : 1);
}

if (options.command === 'generate') {
  const prompt = options.textParts.join(' ');
  if (!prompt) usage();
  const apiKey =
    options.apiKey || process.env.PEEL_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      'generate requires an API key: pass --api-key or set PEEL_API_KEY / OPENAI_API_KEY'
    );
    process.exit(2);
  }
  const llmRuntime = {
    baseUrl: process.env.PROVIDER_BASE_URL || 'https://api.openai.com/v1',
    timeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS) || 30_000,
  };
  const result = await runPeelSkill(
    {
      input: prompt,
      apiKey,
      model: options.model || process.env.DEFAULT_MODEL || 'gpt-4o-mini',
    },
    { llmRuntime }
  );
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        status: result.status,
        content: result.content,
        topic: result.topic,
        validation: result.validation,
        entities: result.entities,
        retries: result.retries,
        issues: result.issues,
      },
      null,
      2
    )
  );
  process.exit(result.ok ? 0 : 1);
}

if (options.command === 'calibrate') {
  const [subcommand, ...rest] = options.textParts;
  if (subcommand === 'export') {
    const { dest, count } = await exportBatch({
      perCategory: options.perCategory ?? undefined,
      seed: options.seed,
    });
    console.log(JSON.stringify({ exported: count, dest }, null, 2));
    process.exit(0);
  }
  if (subcommand === 'import') {
    if (rest.length === 0) usage();
    const annotatedFiles = [];
    for (const file of rest) {
      annotatedFiles.push({ file, annotations: await readJsonl(file) });
    }
    const report = buildCalibrationReport(annotatedFiles);
    const { jsonPath, mdPath } = await writeCalibrationReport(report);
    console.log(
      JSON.stringify(
        {
          raters: report.raters,
          nEntries: report.nEntries,
          nInvalidAnnotations: report.nInvalidAnnotations,
          agreementWithSynthetic: report.agreement.withSynthetic,
          nDisputed: report.agreement.nDisputed,
          pairwiseKappa: report.pairwiseKappa,
          report: jsonPath,
          markdown: mdPath,
        },
        null,
        2
      )
    );
    process.exit(report.nInvalidAnnotations > 0 ? 1 : 0);
  }
  usage();
}

usage();
