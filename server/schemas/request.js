import {
  COMMAND_NAMES,
  getCommandDefinition,
} from '../commands/registry.js';

/**
 * Lightweight runtime request validator. No external deps.
 *
 * validateRequest(command, body) -> { ok, errors, value }
 *  - ok: true only when errors is empty
 *  - errors: Array<{ field, message }>
 *  - value: normalized request ({ command, input, apiKey, model, userId, history, aiScore })
 *           present when ok; undefined when the body itself is not an object
 */

const VALID_ROLES = new Set(['user', 'assistant']);
const FORBIDDEN_FIELDS = ['baseUrl'];

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function error(field, message) {
  return { field, message };
}

function invalid(errors) {
  return {
    ok: false,
    code: 'INVALID_REQUEST',
    issues: errors,
    errors,
    value: undefined,
  };
}

function validateHistory(history) {
  const errors = [];
  if (!Array.isArray(history)) {
    return { errors, value: [] };
  }
  const normalized = [];
  history.forEach((entry, index) => {
    if (
      !isPlainObject(entry) ||
      !VALID_ROLES.has(entry.role) ||
      typeof entry.content !== 'string'
    ) {
      errors.push(error(`history[${index}]`, 'Each history entry needs role "user"|"assistant" and string content.'));
      return;
    }
    normalized.push({ role: entry.role, content: entry.content });
  });
  return { errors, value: normalized };
}

export function validateRequest(command, body) {
  if (!isPlainObject(body)) {
    return invalid([error('body', 'Request body must be an object.')]);
  }

  const errors = [];
  const cmd = String(command || '').toLowerCase();
  const definition = getCommandDefinition(cmd);
  if (!definition) {
    errors.push(error('command', `Unknown command "${command}". Expected one of: ${COMMAND_NAMES.join(', ')}.`));
  }

  const maxInputChars = definition?.inputSchema?.maxInputChars ?? 5000;
  const inputRequired = Boolean(
    definition?.inputSchema?.required?.includes('input')
  );

  const rawInput = body.input;
  const input = rawInput == null ? '' : rawInput;
  if (typeof input !== 'string') {
    errors.push(error('input', 'Input must be a string.'));
  }
  if (typeof input === 'string' && input.length > maxInputChars) {
    errors.push(error('input', `Input exceeds the ${maxInputChars} character limit.`));
  }
  if (inputRequired && typeof input === 'string' && input.trim() === '') {
    errors.push(error('input', 'Input is required for this command.'));
  }

  for (const field of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      errors.push(error(field, `${field} is not allowed in the request body.`));
    }
  }
  if (body.aiScore === true) {
    errors.push(error('aiScore', 'aiScore is disabled and must not be true.'));
  }

  const { errors: historyErrors, value: history } = validateHistory(
    Array.isArray(body.history) ? body.history : []
  );
  errors.push(...historyErrors);

  const apiKey =
    body.apiKey == null || typeof body.apiKey === 'string'
      ? body.apiKey
      : undefined;
  if (body.apiKey != null && typeof body.apiKey !== 'string') {
    errors.push(error('apiKey', 'apiKey must be a string when provided.'));
  }

  const model = typeof body.model === 'string' ? body.model : 'gpt-4o-mini';
  const userId = typeof body.userId === 'string' ? body.userId : 'default';

  if (errors.length > 0) {
    return invalid(errors);
  }

  return {
    ok: true,
    code: null,
    issues: [],
    errors: [],
    value: {
      command: cmd,
      input,
      apiKey,
      model,
      userId,
      history,
      aiScore: false,
    },
  };
}
