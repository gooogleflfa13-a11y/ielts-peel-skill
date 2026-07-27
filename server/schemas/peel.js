/**
 * Lightweight runtime validators for PEEL data shapes. No external deps.
 *
 * A validator returns { ok: boolean, errors: Array<{ field, message }> }.
 * `ok` is true only when `errors` is empty.
 */

export const PEEL_LABELS = ['P', 'E1', 'E2', 'L'];

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

/**
 * Validate a single PEEL unit { P, E1, E2, L }.
 */
export function validatePeelUnit(value) {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      errors: [error('PeelUnit', 'A PeelUnit must be an object with P, E1, E2, L layers.')],
    };
  }

  const errors = [];
  for (const label of PEEL_LABELS) {
    const layer = value[label];
    if (typeof layer !== 'string' || layer.trim() === '') {
      errors.push(
        error(label, `${label} must be a non-empty string.`)
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Validate an array of PEEL units. Field paths are indexed (`[0].P`).
 */
export function validatePeelUnits(value) {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      errors: [error('PeelUnits', 'PeelUnits must be an array of PeelUnit objects.')],
    };
  }

  const errors = [];
  value.forEach((unit, index) => {
    const result = validatePeelUnit(unit);
    for (const err of result.errors) {
      errors.push(error(`[${index}].${err.field}`, err.message));
    }
  });

  return { ok: errors.length === 0, errors };
}
