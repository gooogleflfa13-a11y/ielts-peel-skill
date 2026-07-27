import { beforeEach, describe, expect, it, vi } from 'vitest';

const llm = vi.hoisted(() => ({
  callLLM: vi.fn(),
}));

vi.mock('../../server/utils/llmClient.js', async (importOriginal) => ({
  ...(await importOriginal()),
  callLLM: llm.callLLM,
}));

import {
  WIZARD_STATES,
  determineWizardState,
  wizardStatePolicy,
} from '../../server/wizard/wizardState.js';

describe('wizardState - state determination', () => {
  it('returns AWAITING_DETAILS when there is no conversation history', () => {
    expect(determineWizardState({ history: [] })).toBe(
      WIZARD_STATES.AWAITING_DETAILS
    );
  });

  it('returns READY_TO_GENERATE once the learner has answered (history present)', () => {
    expect(
      determineWizardState({
        history: [{ role: 'assistant', content: 'Where did you study?' }],
      })
    ).toBe(WIZARD_STATES.READY_TO_GENERATE);
  });

  it('lets an explicit phase field override history-length inference', () => {
    expect(
      determineWizardState({
        history: [{ role: 'assistant', content: 'Where did you study?' }],
        phase: WIZARD_STATES.AWAITING_DETAILS,
      })
    ).toBe(WIZARD_STATES.AWAITING_DETAILS);

    expect(
      determineWizardState({ history: [], phase: WIZARD_STATES.READY_TO_GENERATE })
    ).toBe(WIZARD_STATES.READY_TO_GENERATE);
  });
});

describe('wizardState - state policy', () => {
  it('AWAITING_DETAILS emits questions only and never persists', () => {
    const policy = wizardStatePolicy(WIZARD_STATES.AWAITING_DETAILS);
    expect(policy.expectsScripts).toBe(false);
    expect(policy.emits).toBe('questions');
    expect(policy.persists).toBe(false);
  });

  it('READY_TO_GENERATE emits scripts plus routing table and persists', () => {
    const policy = wizardStatePolicy(WIZARD_STATES.READY_TO_GENERATE);
    expect(policy.expectsScripts).toBe(true);
    expect(policy.emits).toBe('scripts');
    expect(policy.persists).toBe(true);
  });
});

describe('wizardSkill - state machine driven persistence', () => {
  beforeEach(() => {
    llm.callLLM.mockReset();
  });

  it('does NOT persist on the AWAITING_DETAILS turn even when questions are valid', async () => {
    const validQuestions = `1. Where did you last study with other students?
2. Which classroom object do you remember most clearly?
3. When did a teacher last change your mind?`;
    llm.callLLM.mockResolvedValueOnce({ content: validQuestions, usage: null });

    const memoryStore = {
      getRelevantFuel: vi.fn(() => []),
      getWeaknessReport: vi.fn(() => null),
      addE2Fuel: vi.fn(),
      recordResult: vi.fn(),
    };
    const { runWizardSkill } = await import('../../server/skills/wizardSkill.js');

    const result = await runWizardSkill({
      input: '/wizard',
      model: 'fake',
      memoryStore,
    });

    expect(result.status).toBe('success');
    expect(memoryStore.addE2Fuel).not.toHaveBeenCalled();
    expect(memoryStore.recordResult).not.toHaveBeenCalled();
  });

  it('persists learner fuel and result on the READY_TO_GENERATE turn', async () => {
    const validPeel = `[P] Physical schooling develops social competence.
[E1] Daily peer negotiation teaches conflict resolution and empathy.
[E2] Students in university seminar rooms form study groups around whiteboards.
[L] Thus, physical schooling supports holistic education.`;
    const validWizard = `${[validPeel, validPeel, validPeel].join('\n')}

| 用户细节关键词 | 命中母题 | 推荐节点 | 可横向秒杀的题型举例 |
| --- | --- | --- | --- |
| seminar | education | social contact | online learning |`;
    llm.callLLM.mockResolvedValueOnce({ content: validWizard, usage: null });

    const memoryStore = {
      getRelevantFuel: vi.fn(() => []),
      getWeaknessReport: vi.fn(() => null),
      addE2Fuel: vi.fn(),
      recordResult: vi.fn(),
    };
    const { runWizardSkill } = await import('../../server/skills/wizardSkill.js');

    const result = await runWizardSkill({
      input: 'I studied in seminar rooms',
      history: [{ role: 'assistant', content: 'Where did you study?' }],
      model: 'fake',
      memoryStore,
    });

    expect(result.status).toBe('success');
    expect(memoryStore.addE2Fuel).toHaveBeenCalledOnce();
    expect(memoryStore.recordResult).toHaveBeenCalledOnce();
  });
});
