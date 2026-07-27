import { getCommandDefinition } from '../commands/registry.js';

const VALID_STATUSES = new Set(['success', 'quality_failed']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function issue(field, message) {
  return { field, message };
}

function invalid(issues) {
  return {
    ok: false,
    code: 'INVALID_RESPONSE',
    issues,
    errors: issues,
  };
}

export function validateResponse(command, result) {
  const definition = getCommandDefinition(command);
  if (!definition) {
    return { ok: true, code: null, issues: [], errors: [] };
  }
  if (!isObject(result)) {
    return invalid([issue('result', 'Command result must be an object.')]);
  }

  const issues = [];
  if (!VALID_STATUSES.has(result.status)) {
    issues.push(issue('status', 'Status must be success or quality_failed.'));
  }

  for (const field of definition.outputContract.fields) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      issues.push(issue(field, `${field} is required by the ${definition.name} response contract.`));
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(result, 'content') &&
    result.content !== null &&
    typeof result.content !== 'string'
  ) {
    issues.push(issue('content', 'content must be a string or null.'));
  }
  if (
    Object.prototype.hasOwnProperty.call(result, 'retries') &&
    (!Number.isInteger(result.retries) || result.retries < 0)
  ) {
    issues.push(issue('retries', 'retries must be a non-negative integer.'));
  }
  if (
    Object.prototype.hasOwnProperty.call(result, 'entities') &&
    !Array.isArray(result.entities)
  ) {
    issues.push(issue('entities', 'entities must be an array.'));
  }

  return issues.length
    ? invalid(issues)
    : { ok: true, code: null, issues: [], errors: [] };
}
