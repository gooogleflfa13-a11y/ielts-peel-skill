import {
  corpusSummary,
  promptCases,
  revisionCases,
  validatorCases,
} from '../evals/corpus.mjs';
import {
  EVAL_THRESHOLDS,
  macroF1,
  revisionMetrics,
  thresholdsMet,
  validatorMetrics,
} from '../evals/metrics.mjs';

const topic = macroF1(promptCases);
const validator = validatorMetrics(validatorCases);
const revision = revisionMetrics(revisionCases);
const metrics = {
  topicMacroF1: topic.value,
  validatorPrecision: validator.precision,
  validatorRecall: validator.recall,
  semanticFalseAcceptRate: validator.falseAcceptRate,
  revisionTargetResolutionRate: revision.targetResolutionRate,
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
    `EVAL THRESHOLDS NOT MET: expected topicMacroF1>=${EVAL_THRESHOLDS.topicMacroF1}, ` +
      `semanticFalseAcceptRate<=${EVAL_THRESHOLDS.semanticFalseAcceptRate}, ` +
      `revisionTargetResolutionRate>=${EVAL_THRESHOLDS.revisionTargetResolutionRate}; ` +
      `got ${JSON.stringify(metrics)}`
  );
  process.exitCode = 1;
}
