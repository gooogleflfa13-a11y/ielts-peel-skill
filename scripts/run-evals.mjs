import {
  corpusSummary,
  matrixCases,
  promptCases,
  revisionCases,
  validatorCases,
  wizardCases,
} from '../evals/corpus.mjs';
import {
  EVAL_THRESHOLDS,
  macroF1,
  matrixMetrics,
  revisionMetrics,
  thresholdsMet,
  validatorMetrics,
  wizardMetrics,
} from '../evals/metrics.mjs';

const topic = macroF1(promptCases);
const validator = validatorMetrics(validatorCases);
const revision = revisionMetrics(revisionCases);
const matrix = matrixMetrics(matrixCases);
const wizard = wizardMetrics(wizardCases);
const metrics = {
  topicMacroF1: topic.value,
  validatorPrecision: validator.precision,
  validatorRecall: validator.recall,
  semanticFalseAcceptRate: validator.falseAcceptRate,
  revisionTargetResolutionRate: revision.targetResolutionRate,
  matrixContractAccuracy: matrix.accuracy,
  wizardContractAccuracy: wizard.accuracy,
};

const report = {
  generatedAt: new Date().toISOString(),
  corpus: corpusSummary,
  metrics,
  counts: validator.counts,
  failures: {
    topic: topic.failures.slice(0, 25),
    validator: validator.failures.slice(0, 25),
    revision: revision.failures.slice(0, 25),
    matrix: matrix.failures.slice(0, 25),
    wizard: wizard.failures.slice(0, 25),
  },
  limitations: [
    'Synthetic project-authored corpus; no teacher calibration or band labels.',
    'Criterion-aligned feedback remains a proxy and must not be presented as an IELTS score.',
    'Pronunciation is not assessed from text.',
  ],
};

console.log(JSON.stringify(report, null, 2));

if (!thresholdsMet(metrics)) {
  console.error(
    `EVAL THRESHOLDS NOT MET: expected ${JSON.stringify(EVAL_THRESHOLDS)}; got ${JSON.stringify(metrics)}`
  );
  process.exitCode = 1;
}
