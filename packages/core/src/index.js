/**
 * @ielts-peel/core — stable public API surface for the PEEL engine.
 *
 * Re-exports the single-source-of-truth implementations from the server
 * tree so the contract layer (contracts/commands.json) and the CLI
 * (packages/cli) consume the same code paths as the HTTP API. The exports
 * here are the frozen contract: server internals may be refactored as long
 * as these signatures stay stable.
 */

// Parsing
export { parsePeelOutput, parseLooseLines } from '../../../server/parsing/peelParser.js';

// Structural validation (107 regex + entity bank)
export { validatePeel, validatePeels, detectEntities } from '../../../server/evaluation/validator.js';

// Semantic quality layer (6 heuristic rules)
export { semanticQualityIssues } from '../../../server/evaluation/semanticChecks.js';

// Quality gate orchestration
export {
  evaluatePeelOutput,
  evaluateWizardQuestions,
  matrixContractIssues,
  wizardScriptIssues,
  finalizeGeneratedOutput,
  buildRepairInstruction,
} from '../../../server/evaluation/outputQuality.js';

// Feedback builders
export {
  buildStructuralFeedback,
  STRUCTURAL_FEEDBACK_DISCLAIMER,
} from '../../../server/evaluation/structuralFeedback.js';
export {
  buildCriterionFeedback,
  CRITERION_FEEDBACK_DISCLAIMER,
} from '../../../server/evaluation/criterionFeedback.js';

// Topic knowledge
export {
  classifyTopic,
  retrieveTopic,
  loadTopicKnowledge,
  matchReductionModel,
} from '../../../server/knowledge/topicRetriever.js';
