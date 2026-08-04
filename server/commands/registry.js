import { MAX_INPUT_CHARS } from '../utils/constants.js';

/**
 * Central command registry. Single source of truth for the five skill
 * commands. Consumed by the unified pipeline, app validation, capability
 * responses, and the drift check.
 *
 * Each definition declares:
 *  - name: lowercase command id
 *  - description: human readable purpose
 *  - skill: IELTS skill surface - 'writing' | 'speaking' | 'both'
 *  - inputSchema: declarative shape of the accepted request
 *  - outputContract: declarative shape of the produced result
 *  - requiresApiKey(input): whether an upstream LLM key is required
 *  - requiresBank: whether the private question-bank feature must be enabled
 *  - repairable: whether the generative path runs the repair/finalize loop
 */

function bankRequiresApiKey(input) {
  const text = String(input ?? '');
  return (
    /^\s*\/?bank\s+(peel|answer|答|作答)\b/i.test(text) ||
    (/\bpeel\b/i.test(text) &&
      !/random|search|links|stats|抽题|随机|搜|关联/i.test(text))
  );
}

const PEEL = {
  name: 'peel',
  skill: 'both',
  description:
    'Generate one locked [P]-[E1]-[E2]-[L] body paragraph for Writing Task 2 / Speaking Part 3.',
  inputSchema: {
    command: 'peel',
    required: ['input'],
    optional: ['history', 'apiKey', 'model', 'userId'],
    maxInputChars: MAX_INPUT_CHARS,
    historyMaxTurns: 12,
  },
  outputContract: {
    status: 'success | quality_failed',
    streamable: true,
    fields: [
      'content',
      'parsed',
      'validation',
      'topic',
      'entities',
      'retries',
    ],
  },
  requiresApiKey: () => true,
  requiresBank: false,
  repairable: true,
};

const MATRIX = {
  name: 'matrix',
  skill: 'writing',
  description:
    'Generate a horizontal-kill matrix: one reduction model, one baseline PEEL, three isomorphic question PEELs, and a logic note.',
  inputSchema: {
    command: 'matrix',
    required: ['input'],
    optional: ['history', 'apiKey', 'model', 'userId'],
    maxInputChars: MAX_INPUT_CHARS,
    historyMaxTurns: 12,
  },
  outputContract: {
    status: 'success | quality_failed',
    streamable: false,
    fields: [
      'content',
      'parsed',
      'validation',
      'topic',
      'reductionModel',
      'entities',
      'retries',
    ],
  },
  requiresApiKey: () => true,
  requiresBank: false,
  repairable: true,
};

const WIZARD = {
  name: 'wizard',
  skill: 'writing',
  description:
    'Two-phase personalization: first turn asks 3-4 life-detail questions, later turns emit 3-4 personal PEEL scripts plus a routing table.',
  inputSchema: {
    command: 'wizard',
    required: [],
    optional: ['input', 'history', 'apiKey', 'model', 'userId'],
    maxInputChars: MAX_INPUT_CHARS,
    historyMaxTurns: 12,
  },
  outputContract: {
    status: 'success | quality_failed',
    streamable: false,
    fields: [
      'content',
      'parsed',
      'validation',
      'topic',
      'entities',
      'retries',
    ],
  },
  requiresApiKey: () => true,
  requiresBank: false,
  repairable: true,
};

const SCORE = {
  name: 'score',
  aliases: ['review'],
  skill: 'both',
  description:
    'Deterministic PEEL Structure Review of a user-pasted paragraph. No LLM call, no generation, no repair.',
  inputSchema: {
    command: 'score',
    required: ['input'],
    optional: [],
    maxInputChars: MAX_INPUT_CHARS,
    historyMaxTurns: 0,
  },
  outputContract: {
    status: 'success',
    streamable: false,
    fields: ['content', 'parsed', 'feedback'],
  },
  requiresApiKey: () => false,
  requiresBank: false,
  repairable: false,
};

const BANK = {
  name: 'bank',
  skill: 'speaking',
  description:
    'Private speaking question warehouse: draw, search, link-map, stats, and /bank peel generation. The peel subcommand delegates to the peel skill.',
  inputSchema: {
    command: 'bank',
    required: [],
    optional: ['input', 'history', 'apiKey', 'model', 'userId'],
    maxInputChars: MAX_INPUT_CHARS,
    historyMaxTurns: 12,
    subcommands: ['random', 'search', 'links', 'peel', 'stats'],
  },
  outputContract: {
    status: 'success | quality_failed',
    streamable: false,
    fields: ['content', 'parsed', 'bank', 'topic', 'retries'],
  },
  requiresApiKey: bankRequiresApiKey,
  requiresBank: true,
  repairable: true,
};

const LEARN = {
  name: 'learn',
  skill: 'both',
  description:
    'Learning loop with five modes: practice (student writes first, then feedback), hint (scaffolding questions only), model (generate a tagged model PEEL), compare (student + AI side by side), revise (re-score a prior attempt).',
  inputSchema: {
    command: 'learn',
    required: ['input'],
    optional: ['history', 'apiKey', 'model', 'userId', 'mode', 'studentText', 'attemptId', 'skill'],
    maxInputChars: MAX_INPUT_CHARS,
    historyMaxTurns: 12,
    subcommands: ['practice', 'hint', 'model', 'compare', 'revise'],
  },
  outputContract: {
    status: 'success | quality_failed',
    streamable: false,
    fields: ['content', 'parsed', 'feedback', 'topic', 'retries'],
  },
  // apiKey is validated per-mode inside the skill (model/compare need it;
  // practice/hint/revise are deterministic). The app gate does not require it.
  requiresApiKey: () => false,
  requiresBank: false,
  repairable: false,
};

export const COMMAND_REGISTRY = [PEEL, MATRIX, WIZARD, SCORE, BANK, LEARN];

export const COMMAND_NAMES = COMMAND_REGISTRY.map((command) => command.name);

const COMMANDS_BY_NAME = Object.fromEntries(
  COMMAND_REGISTRY.map((command) => [command.name, command])
);

export function getCommandDefinition(name) {
  const key = String(name || '').toLowerCase();
  return COMMANDS_BY_NAME[key];
}

export const lookup = getCommandDefinition;

export function requiresApiKey(command, input) {
  const definition = getCommandDefinition(command);
  if (!definition) return false;
  return Boolean(definition.requiresApiKey(input));
}

export function requiresBank(command) {
  const definition = getCommandDefinition(command);
  return Boolean(definition?.requiresBank);
}

export function isRepairable(command) {
  const definition = getCommandDefinition(command);
  return Boolean(definition?.repairable);
}
