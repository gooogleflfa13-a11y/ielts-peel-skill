import { parsePeelOutput } from '../server/parsing/peelParser.js';
import { validatePeels } from '../server/evaluation/validator.js';
import { retrieveTopic } from '../server/knowledge/topicRetriever.js';
import {
  evaluatePeelOutput,
  evaluateWizardQuestions,
  matrixContractIssues,
  wizardScriptIssues,
} from '../server/evaluation/outputQuality.js';

/**
 * Shared evaluation metrics over the project-authored corpus
 * (evals/corpus.mjs). Consumed both by the standalone report script
 * (scripts/run-evals.mjs) and by the regression gate in
 * tests/unit/evalCorpus.test.js, so the reported numbers and the CI check
 * always use the same computation.
 */

export const EVAL_THRESHOLDS = {
  topicMacroF1: 0.85,
  semanticFalseAcceptRate: 0.1,
  revisionTargetResolutionRate: 0.85,
  matrixContractAccuracy: 0.9,
  wizardContractAccuracy: 0.9,
};

export function safeDivide(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

export function macroF1(cases) {
  const labels = [...new Set(cases.map((item) => item.topic))];
  const rows = cases.map((item) => ({
    expected: item.topic,
    actual: retrieveTopic(item.prompt).classification?.topicId || 'Unknown',
  }));
  const scores = labels.map((label) => {
    const tp = rows.filter((row) => row.expected === label && row.actual === label).length;
    const fp = rows.filter((row) => row.expected !== label && row.actual === label).length;
    const fn = rows.filter((row) => row.expected === label && row.actual !== label).length;
    const precision = safeDivide(tp, tp + fp);
    const recall = safeDivide(tp, tp + fn);
    return safeDivide(2 * precision * recall, precision + recall);
  });
  return {
    value: safeDivide(scores.reduce((sum, score) => sum + score, 0), scores.length),
    failures: rows.filter((row) => row.actual !== row.expected),
  };
}

export function review(response, prompt) {
  const parsed = parsePeelOutput(response);
  if (!parsed.ok) return { passed: false, issues: parsed.issues || [] };
  return validatePeels(parsed.peels, { prompt });
}

export function validatorMetrics(cases) {
  let tp = 0;
  let tn = 0;
  let fp = 0;
  let fn = 0;
  const failures = [];
  for (const item of cases) {
    const result = review(item.response, item.prompt);
    if (item.expectedPass && result.passed) tp += 1;
    else if (!item.expectedPass && !result.passed) tn += 1;
    else if (!item.expectedPass && result.passed) fp += 1;
    else fn += 1;
    if (result.passed !== item.expectedPass) {
      failures.push({ id: item.id, category: item.category, expectedPass: item.expectedPass, actualPass: result.passed });
    }
  }
  return {
    precision: safeDivide(tp, tp + fp),
    recall: safeDivide(tp, tp + fn),
    falseAcceptRate: safeDivide(fp, fp + tn),
    counts: { tp, tn, fp, fn },
    failures,
  };
}

export function revisionMetrics(cases) {
  let originalRejected = 0;
  let revisedAccepted = 0;
  let resolved = 0;
  const failures = [];
  for (const item of cases) {
    const original = review(item.original, item.prompt);
    const revised = review(item.revised, item.prompt);
    if (!original.passed) originalRejected += 1;
    if (revised.passed) revisedAccepted += 1;
    if (!original.passed && revised.passed) resolved += 1;
    if (original.passed || !revised.passed) {
      failures.push({ id: item.id, originalPass: original.passed, revisedPass: revised.passed });
    }
  }
  return {
    originalRejectionRate: safeDivide(originalRejected, cases.length),
    revisedAcceptanceRate: safeDivide(revisedAccepted, cases.length),
    targetResolutionRate: safeDivide(resolved, cases.length),
    failures,
  };
}

/**
 * Matrix contract gate: evaluatePeelOutput with matrixContractIssues over the
 * four-PEEL matrix corpus (same evaluate path as server/skills/matrixSkill.js).
 */
export function matrixMetrics(cases) {
  let correct = 0;
  const failures = [];
  for (const item of cases) {
    const result = evaluatePeelOutput(item.response, {
      minPeels: 4,
      maxPeels: 4,
      extraIssues: matrixContractIssues,
      prompt: item.prompt,
    });
    if (result.passed === item.expectedPass) correct += 1;
    else {
      failures.push({
        id: item.id,
        category: item.category,
        expectedPass: item.expectedPass,
        actualPass: result.passed,
      });
    }
  }
  return { accuracy: safeDivide(correct, cases.length), failures };
}

/**
 * Wizard contract gate: questions stage via evaluateWizardQuestions, scripts
 * stage via evaluatePeelOutput + wizardScriptIssues (same split as
 * server/skills/wizardSkill.js).
 */
export function wizardMetrics(cases) {
  let correct = 0;
  const failures = [];
  for (const item of cases) {
    const result =
      item.stage === 'questions'
        ? evaluateWizardQuestions(item.response)
        : evaluatePeelOutput(item.response, {
            minPeels: 3,
            maxPeels: 4,
            extraIssues: wizardScriptIssues,
            prompt: item.prompt,
          });
    if (result.passed === item.expectedPass) correct += 1;
    else {
      failures.push({
        id: item.id,
        category: item.category,
        expectedPass: item.expectedPass,
        actualPass: result.passed,
      });
    }
  }
  return { accuracy: safeDivide(correct, cases.length), failures };
}

/**
 * Run the full metric set over the corpus. Returns the same shape as the
 * `metrics` block of the run-evals report.
 */
export function computeEvalMetrics({ promptCases, validatorCases, revisionCases, matrixCases, wizardCases }) {
  const topic = macroF1(promptCases);
  const validator = validatorMetrics(validatorCases);
  const revision = revisionMetrics(revisionCases);
  const matrix = matrixMetrics(matrixCases);
  const wizard = wizardMetrics(wizardCases);
  return {
    topicMacroF1: topic.value,
    validatorPrecision: validator.precision,
    validatorRecall: validator.recall,
    semanticFalseAcceptRate: validator.falseAcceptRate,
    revisionTargetResolutionRate: revision.targetResolutionRate,
    matrixContractAccuracy: matrix.accuracy,
    wizardContractAccuracy: wizard.accuracy,
  };
}

/**
 * True when every threshold in EVAL_THRESHOLDS is met.
 */
export function thresholdsMet(metrics) {
  return (
    metrics.topicMacroF1 >= EVAL_THRESHOLDS.topicMacroF1 &&
    metrics.semanticFalseAcceptRate <= EVAL_THRESHOLDS.semanticFalseAcceptRate &&
    metrics.revisionTargetResolutionRate >= EVAL_THRESHOLDS.revisionTargetResolutionRate &&
    metrics.matrixContractAccuracy >= EVAL_THRESHOLDS.matrixContractAccuracy &&
    metrics.wizardContractAccuracy >= EVAL_THRESHOLDS.wizardContractAccuracy
  );
}
