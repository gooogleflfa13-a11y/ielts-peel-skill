export const WIZARD_STATES = Object.freeze({
  AWAITING_DETAILS: 'AWAITING_DETAILS',
  READY_TO_GENERATE: 'READY_TO_GENERATE',
});

/**
 * Determine the wizard state from an explicit phase field first, then from
 * conversation history length. Never relies on LLM inference.
 *
 * @param {{ history?: Array<{role:string,content:string}>, phase?: string }} input
 * @returns {string} one of WIZARD_STATES
 */
export function determineWizardState({ history = [], phase = null } = {}) {
  if (phase === WIZARD_STATES.READY_TO_GENERATE) {
    return WIZARD_STATES.READY_TO_GENERATE;
  }
  if (phase === WIZARD_STATES.AWAITING_DETAILS) {
    return WIZARD_STATES.AWAITING_DETAILS;
  }
  return Array.isArray(history) && history.length > 0
    ? WIZARD_STATES.READY_TO_GENERATE
    : WIZARD_STATES.AWAITING_DETAILS;
}

/**
 * Policy for what a given wizard state is allowed to do.
 * AWAITING_DETAILS emits questions only and never persists.
 * READY_TO_GENERATE emits scripts plus the routing table and persists learner fuel.
 *
 * @param {string} state
 * @returns {{ emits: string, expectsScripts: boolean, persists: boolean }}
 */
export function wizardStatePolicy(state) {
  if (state === WIZARD_STATES.READY_TO_GENERATE) {
    return { emits: 'scripts', expectsScripts: true, persists: true };
  }
  return { emits: 'questions', expectsScripts: false, persists: false };
}
