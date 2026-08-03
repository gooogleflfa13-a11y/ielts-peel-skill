import { parsePeelOutput } from '../server/parsing/peelParser.js';
import { validatePeels } from '../server/evaluation/validator.js';
import { retrieveTopic } from '../server/knowledge/topicRetriever.js';
import {
  corpusSummary,
  promptCases,
  revisionCases,
  validatorCases,
} from '../evals/corpus.mjs';

function safeDivide(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function macroF1(cases) {
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

function review(response, prompt) {
  const parsed = parsePeelOutput(response);
  if (!parsed.ok) return { passed: false, issues: parsed.issues || [] };
  return validatePeels(parsed.peels, { prompt });
}

function validatorMetrics(cases) {
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

function revisionMetrics(cases) {
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

const topic = macroF1(promptCases);
const validator = validatorMetrics(validatorCases);
const revision = revisionMetrics(revisionCases);
const report = {
  generatedAt: new Date().toISOString(),
  corpus: corpusSummary,
  metrics: {
    topicMacroF1: topic.value,
    validatorPrecision: validator.precision,
    validatorRecall: validator.recall,
    semanticFalseAcceptRate: validator.falseAcceptRate,
    revisionTargetResolutionRate: revision.targetResolutionRate,
  },
  counts: validator.counts,
  failures: {
    topic: topic.failures.slice(0, 25),
    validator: validator.failures.slice(0, 25),
    revision: revision.failures.slice(0, 25),
  },
  limitations: [
    'Synthetic project-authored corpus; no teacher calibration or band labels.',
    'Criterion-aligned feedback remains a proxy and must not be presented as an IELTS score.',
    'Pronunciation is not assessed from text.',
  ],
};

console.log(JSON.stringify(report, null, 2));

const thresholds = {
  topicMacroF1: 0.85,
  semanticFalseAcceptRate: 0.1,
  revisionTargetResolutionRate: 0.85,
};

if (
  report.metrics.topicMacroF1 < thresholds.topicMacroF1 ||
  report.metrics.semanticFalseAcceptRate > thresholds.semanticFalseAcceptRate ||
  report.metrics.revisionTargetResolutionRate < thresholds.revisionTargetResolutionRate
) {
  process.exitCode = 1;
}

