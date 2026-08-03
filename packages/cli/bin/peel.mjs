#!/usr/bin/env node
/**
 * @ielts-peel/cli — command-line adapter for the deterministic PEEL engine.
 *
 * Commands (see contracts/commands.json):
 *   classify <prompt>            Topic classification (stage 1 of /peel, /matrix)
 *   review [opts] <peel-text>    Deterministic PEEL review (workflow: /review)
 *   review [opts] -              Read PEEL text from stdin
 *
 * Options:
 *   --prompt <text>   Original question, enables input-aware checks (OFF_TOPIC)
 *   --skill <s>       'writing' (default) or 'speaking' — criterion proxy mapping
 *
 * Always prints a single JSON object to stdout; exits 1 on unknown usage.
 */
import { readFileSync } from 'node:fs';
import { classifyPrompt, reviewPeel } from '../../core/src/engine.js';

function usage() {
  console.error(
    [
      'Usage:',
      '  peel-hacker classify <prompt>',
      '  peel-hacker review [--prompt <prompt>] [--skill writing|speaking] <peel-text...>',
      '  peel-hacker review [--prompt <prompt>] -   (read PEEL text from stdin)',
    ].join('\n')
  );
  process.exit(2);
}

function parseArgs(argv) {
  const options = { command: null, prompt: null, skill: 'writing', textParts: [] };
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

usage();
