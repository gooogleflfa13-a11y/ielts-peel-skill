export const STRUCTURAL_FEEDBACK_DISCLAIMER =
  'PEEL structure feedback only. Not an official IELTS assessment or band estimate.';

const CHECK_NAMES = [
  'labels',
  'layerBoundaries',
  'e2Concreteness',
  'linkClosure',
  'bannedGlue',
];

function classifyIssue(issue) {
  const text = typeof issue === 'string'
    ? issue
    : [issue?.code, issue?.layer, issue?.evidence, issue?.message].filter(Boolean).join(' ');

  if (/banned|discourse glue/i.test(text)) return 'bannedGlue';
  if (/label|missing|order|duplicate|parse/i.test(text)) return 'labels';
  const sourceLayer = issue?.layer || text.match(/^\s*(P|E1|E2|L)\b/i)?.[1];
  if (/^E2$/i.test(sourceLayer)) return 'e2Concreteness';
  if (/^L$/i.test(sourceLayer)) return 'linkClosure';
  if (/^(P|E1)$/i.test(sourceLayer)) return 'layerBoundaries';
  if (/\bE2\b|physical|concrete/i.test(text)) return 'e2Concreteness';
  if (/\bL\b|link|closure/i.test(text)) return 'linkClosure';
  return 'layerBoundaries';
}

function normalizeIssue(issue) {
  if (issue && typeof issue === 'object') {
    return {
      layer: issue.layer || null,
      code: issue.code || 'STRUCTURAL_ISSUE',
      evidence: issue.evidence || issue.message || 'A structural check failed.',
      action: issue.action || 'Revise the affected PEEL layer and run the review again.',
    };
  }

  const evidence = String(issue);
  const check = classifyIssue(evidence);
  const details = {
    labels: {
      layer: null,
      code: 'LABELS',
      action: 'Use exactly one [P], [E1], [E2], and [L] label in that order.',
    },
    layerBoundaries: {
      layer: null,
      code: 'LAYER_BOUNDARIES',
      action: 'Keep each sentence within the job of its labeled PEEL layer.',
    },
    e2Concreteness: {
      layer: 'E2',
      code: 'E2_CONCRETENESS',
      action: 'Add a concrete person, place, object, or observable action to E2.',
    },
    linkClosure: {
      layer: 'L',
      code: 'LINK_CLOSURE',
      action: 'Rewrite L as one sentence that closes back to P without a new claim.',
    },
    bannedGlue: {
      layer: null,
      code: 'BANNED_GLUE',
      action: 'Remove the banned discourse phrase and connect the logic directly.',
    },
  }[check];

  const sourceLayer = evidence.match(/^\s*(P|E1|E2|L)\b/i)?.[1]?.toUpperCase();
  return { ...details, layer: sourceLayer || details.layer, evidence };
}

function checkFailed(value) {
  return value === false || value === 'fail' || value?.passed === false || value?.status === 'fail';
}

export function buildStructuralFeedback(parseResult, validation) {
  const parseable = parseResult?.ok !== false
    && Array.isArray(parseResult?.peels)
    && parseResult.peels.length > 0
    && parseResult.peels.every((peel) =>
      ['P', 'E1', 'E2', 'L'].every((layer) => typeof peel?.[layer] === 'string' && peel[layer].trim())
    );
  const checks = Object.fromEntries(CHECK_NAMES.map((name) => [name, 'pass']));

  if (!parseable) {
    for (const name of CHECK_NAMES) checks[name] = 'fail';
    return {
      feedback: {
        scope: 'peel_structure_only',
        status: 'unparseable',
        checks,
        issues: [{
          layer: null,
          code: 'UNPARSEABLE',
          evidence: parseResult?.code || 'The input is not a complete labeled PEEL unit.',
          action: 'Use exactly one [P], [E1], [E2], and [L] line in that order.',
        }],
      },
      disclaimer: STRUCTURAL_FEEDBACK_DISCLAIMER,
    };
  }

  const rawIssues = Array.isArray(validation?.issues)
    ? validation.issues
    : Array.isArray(validation?.allWarnings)
      ? validation.allWarnings
      : [];
  const issues = rawIssues.map(normalizeIssue);

  for (const issue of rawIssues) checks[classifyIssue(issue)] = 'fail';
  for (const name of CHECK_NAMES) {
    if (checkFailed(validation?.checks?.[name])) checks[name] = 'fail';
  }

  return {
    feedback: {
      scope: 'peel_structure_only',
      status: issues.length > 0 || validation?.passed === false
        ? 'issues_found'
        : 'no_issues_detected',
      checks,
      issues,
    },
    disclaimer: STRUCTURAL_FEEDBACK_DISCLAIMER,
  };
}
