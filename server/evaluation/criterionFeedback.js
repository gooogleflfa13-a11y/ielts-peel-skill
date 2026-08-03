export const CRITERION_FEEDBACK_DISCLAIMER =
  'Criterion-aligned proxy feedback reflects PEEL structural checks only. It does not fully assess IELTS criteria and is not an official assessment, band estimate, or examiner score.';

export const CRITERION_FEEDBACK_SCOPE = 'criterion_aligned_structural_proxy';

const UNPARSEABLE_NOTE =
  'The input could not be parsed as a complete labeled PEEL unit. Address the structure before criterion-level feedback is meaningful.';

const PR_NOTE =
  'Pronunciation cannot be assessed from written text. Practice aloud and seek audio-based feedback for this criterion.';

const PASS_NOTES = {
  TR: 'Task structure is complete with concrete supporting evidence.',
  CC: 'Coherence and cohesion checks passed: one sentence per layer, closure back to the point, no formulaic glue.',
  LR: 'No formulaic discourse glue detected; lexical choices support the argument.',
  GRA: 'Sentence structure and terminal punctuation checks passed.',
  FC: 'Logical flow and fluency markers are structurally sound.',
};

const WRITING_MAP = {
  TR: ['labels', 'e2Concreteness'],
  CC: ['layerBoundaries', 'linkClosure', 'bannedGlue'],
  LR: ['bannedGlue'],
  GRA: ['layerBoundaries'],
};

const SPEAKING_MAP = {
  FC: ['layerBoundaries', 'linkClosure', 'bannedGlue'],
  LR: ['bannedGlue'],
  GRA: ['layerBoundaries'],
  PR: [],
};

const ISSUE_CODE_TO_CHECK = {
  MISSING_LAYER: 'labels',
  SENTENCE_COUNT: 'layerBoundaries',
  TERMINAL_PUNCTUATION: 'layerBoundaries',
  P_EXAMPLE: 'layerBoundaries',
  P_CAUSAL_CHAIN: 'layerBoundaries',
  E1_CONCRETE_ENTITY: 'layerBoundaries',
  E2_NOT_CONCRETE: 'e2Concreteness',
  E2_WEAKLY_CONCRETE: 'e2Concreteness',
  L_NEW_EXAMPLE: 'linkClosure',
  L_NOT_CLOSED: 'linkClosure',
  BANNED_GLUE: 'bannedGlue',
  UNPARSEABLE: 'unparseable',
};

function isParseable(parseResult) {
  return (
    parseResult?.ok !== false &&
    Array.isArray(parseResult?.peels) &&
    parseResult.peels.length > 0 &&
    parseResult.peels.every((peel) =>
      ['P', 'E1', 'E2', 'L'].every(
        (layer) => typeof peel?.[layer] === 'string' && peel[layer].trim()
      )
    )
  );
}

function checkFailed(value) {
  return value === false || value === 'fail' || value?.passed === false || value?.status === 'fail';
}

function issuesForCheck(issues, checkName) {
  return (issues || []).filter((issue) => {
    const mapped = issue?.code ? ISSUE_CODE_TO_CHECK[issue.code] : null;
    if (mapped) return mapped === checkName;
    const text = [issue?.code, issue?.layer, issue?.evidence, issue?.message]
      .filter(Boolean)
      .join(' ');
    if (/label|missing|order|duplicate|parse/i.test(text)) return checkName === 'labels';
    if (/banned|discourse glue/i.test(text)) return checkName === 'bannedGlue';
    if (/E2|physical|concrete/i.test(text)) return checkName === 'e2Concreteness';
    if (/L\b|link|closure/i.test(text)) return checkName === 'linkClosure';
    return checkName === 'layerBoundaries';
  });
}

function buildNote(criterionCode, mappedChecks, issues, checks) {
  const relevantIssues = [];
  for (const checkName of mappedChecks) {
    relevantIssues.push(...issuesForCheck(issues, checkName));
    if (checkFailed(checks?.[checkName])) {
      relevantIssues.push({
        evidence: `${checkName} check failed`,
        action: `Address the ${checkName} structural issue.`,
      });
    }
  }

  if (relevantIssues.length === 0) {
    return PASS_NOTES[criterionCode] || 'No structural issues detected for this criterion.';
  }

  const details = relevantIssues
    .slice(0, 3)
    .map((issue) => {
      const evidence = issue.evidence || issue.message || 'structural issue';
      const action = issue.action || 'Revise the affected PEEL layer.';
      return `${evidence}. ${action}`;
    })
    .join(' ');

  return details;
}

function buildCriterion(code, mappedChecks, issues, checks) {
  const hasMappedChecks = mappedChecks.length > 0;
  const anyFailed = mappedChecks.some(
    (checkName) => checkFailed(checks?.[checkName]) || issuesForCheck(issues, checkName).length > 0
  );

  if (!hasMappedChecks) {
    return { status: 'not_assessed', notes: PR_NOTE };
  }

  if (anyFailed) {
    return { status: 'fail', notes: buildNote(code, mappedChecks, issues, checks) };
  }

  return { status: 'pass', notes: PASS_NOTES[code] || 'No structural issues detected.' };
}

export function buildCriterionFeedback({ skill = 'writing', parseResult, validation } = {}) {
  const criteriaMap = skill === 'speaking' ? SPEAKING_MAP : WRITING_MAP;
  const checks = validation?.checks || {};
  const issues = validation?.issues || validation?.allWarnings || [];

  if (!isParseable(parseResult)) {
    const criteria = {};
    for (const code of Object.keys(criteriaMap)) {
      if (criteriaMap[code].length === 0) {
        criteria[code] = { status: 'watch', notes: PR_NOTE };
      } else {
        criteria[code] = { status: 'fail', notes: UNPARSEABLE_NOTE };
      }
    }
    return {
      scope: CRITERION_FEEDBACK_SCOPE,
      criteria,
      disclaimer: CRITERION_FEEDBACK_DISCLAIMER,
    };
  }

  const criteria = {};
  for (const code of Object.keys(criteriaMap)) {
    criteria[code] = buildCriterion(code, criteriaMap[code], issues, checks);
  }

  return {
    scope: CRITERION_FEEDBACK_SCOPE,
    criteria,
    disclaimer: CRITERION_FEEDBACK_DISCLAIMER,
  };
}
