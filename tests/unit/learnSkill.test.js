import { describe, it, expect, vi } from 'vitest';
import { runLearnSkill } from '../../server/learner/learnSkill.js';
import { executeCommand } from '../../server/pipeline/executeCommand.js';
import {
  createNullAttemptStore,
  createLocalAttemptStore,
} from '../../server/learner/attempts.js';
import { createNullMemoryStore } from '../../server/memory/memoryStore.js';

const validPeel = `[P] Physical schooling develops social competence.
[E1] Daily peer negotiation teaches conflict resolution and empathy.
[E2] Students in university seminar rooms form study groups around whiteboards.
[L] Thus, physical schooling supports holistic education.`;

const weakPeel = `[P] Education is good.
[E1] It helps people learn things and stuff.
[E2] Students study.
[L] So education matters.`;

function mockLlmRuntime(peelContent) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content: peelContent } }],
    usage: { total_tokens: 10 },
  });
  const createClient = vi.fn(() => ({ chat: { completions: { create } } }));
  return { baseUrl: 'https://trusted.example/v1', timeoutMs: 5_000, createClient };
}

const baseRequest = {
  input: 'Some people think online education can replace traditional classrooms. Do you agree?',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  userId: 'learner-1',
  memoryStore: createNullMemoryStore(),
};

describe('runLearnSkill - mode routing', () => {
  it('rejects an unknown mode', async () => {
    await expect(
      runLearnSkill({ ...baseRequest, mode: 'invented' }, { attemptStore: createNullAttemptStore() })
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });
});

describe('practice mode', () => {
  it('requires student input before producing feedback', async () => {
    await expect(
      runLearnSkill(
        { ...baseRequest, mode: 'practice', studentText: '   ' },
        { attemptStore: createNullAttemptStore() }
      )
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('returns structural feedback on the student PEEL and records an attempt', async () => {
    const store = createLocalAttemptStore();
    const result = await runLearnSkill(
      { ...baseRequest, mode: 'practice', studentText: weakPeel },
      { attemptStore: store }
    );

    expect(result.mode).toBe('practice');
    expect(result.status).toBe('success');
    expect(result.content).toBe(weakPeel);
    expect(result.feedback).toBeTruthy();
    expect(result.criterionFeedback.scope).toBe('criterion_aligned_structural_proxy');
    expect(result.criterionFeedback.criteria).toHaveProperty('TR');
    expect(result.disclaimer).toEqual(expect.any(String));
    // An attempt was recorded with a stable id.
    expect(result.attemptId).toEqual(expect.any(String));
    const stored = store.loadAttempt({ userId: 'learner-1' }, result.attemptId);
    expect(stored).toMatchObject({ studentText: weakPeel, skill: 'writing' });
  });
});

describe('hint mode', () => {
  it('returns scaffolding questions, never the answer or a PEEL body', async () => {
    const result = await runLearnSkill(
      { ...baseRequest, mode: 'hint' },
      { attemptStore: createNullAttemptStore() }
    );

    expect(result.mode).toBe('hint');
    expect(result.status).toBe('success');
    expect(result.content).toBeTruthy();
    // Scaffolding questions end with ? and guide thinking.
    expect(result.content).toMatch(/\?/);
    // Must NOT hand over a finished PEEL answer.
    expect(result.content).not.toMatch(/\[P\]/);
    expect(result.content).not.toMatch(/\[E1\]/);
  });
});

describe('model mode', () => {
  it('generates a PEEL via the LLM and tags it as a model answer', async () => {
    const runtime = mockLlmRuntime(validPeel);
    const result = await runLearnSkill(
      { ...baseRequest, mode: 'model', skill: 'writing' },
      { attemptStore: createNullAttemptStore(), llmRuntime: runtime }
    );

    expect(result.mode).toBe('model');
    expect(result.status).toBe('success');
    expect(result.content).toContain('[P]');
    expect(result.content).toContain('[L]');
    // Explicitly tagged as a model answer, not the student's own.
    expect(result.isModel).toBe(true);
    expect(result.parsed?.peels?.length).toBeGreaterThanOrEqual(1);
  });

  it('requires an api key (rejects when missing)', async () => {
    await expect(
      runLearnSkill(
        { ...baseRequest, mode: 'model', apiKey: '' },
        { attemptStore: createNullAttemptStore() }
      )
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });
});

describe('compare mode', () => {
  it('returns a structured layer comparison between the student and model PEEL', async () => {
    const runtime = mockLlmRuntime(validPeel);
    const store = createLocalAttemptStore();
    const result = await runLearnSkill(
      {
        ...baseRequest,
        mode: 'compare',
        studentText: weakPeel,
        skill: 'writing',
      },
      { attemptStore: store, llmRuntime: runtime }
    );

    expect(result.mode).toBe('compare');
    expect(result.status).toBe('success');
    // Both the student text and the model PEEL appear in the output.
    expect(result.content).toContain(weakPeel.slice(0, 20));
    expect(result.content).toContain('[P]');
    expect(result.content).toContain('MODEL');
    // Student receives feedback.
    expect(result.feedback).toBeTruthy();
    expect(result.comparison.layers.P).toEqual(expect.objectContaining({
      student: expect.any(String),
      model: expect.any(String),
      changed: expect.any(Boolean),
    }));
    expect(result.comparison.studentIssues).toEqual(expect.any(Array));
    // Attempt recorded.
    expect(result.attemptId).toEqual(expect.any(String));
  });

  it('requires both student input and an api key', async () => {
    await expect(
      runLearnSkill(
        { ...baseRequest, mode: 'compare', studentText: '', apiKey: 'sk-test' },
        { attemptStore: createNullAttemptStore(), llmRuntime: mockLlmRuntime(validPeel) }
      )
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });
});

describe('revise mode', () => {
  it('accepts a new draft, scores it, and records resolved/unresolved issues', async () => {
    const store = createLocalAttemptStore();
    // Seed a prior attempt by running practice first.
    const practice = await runLearnSkill(
      { ...baseRequest, mode: 'practice', studentText: weakPeel },
      { attemptStore: store }
    );
    const priorId = practice.attemptId;

    const result = await runLearnSkill(
      { ...baseRequest, mode: 'revise', attemptId: priorId, studentText: validPeel },
      { attemptStore: store }
    );

    expect(result.mode).toBe('revise');
    expect(result.status).toBe('success');
    expect(result.content).toBe(validPeel);
    expect(result.feedback).toBeTruthy();
    expect(result.revisionDiff.layers.P).toEqual(expect.objectContaining({
      before: 'Education is good.',
      after: 'Physical schooling develops social competence.',
      changed: true,
    }));
    expect(result.resolvedIssues).toEqual(expect.any(Array));
    expect(result.unresolvedIssues).toEqual(expect.any(Array));
    // Re-scoring appends a revision to the prior attempt (append-only history).
    const stored = store.loadAttempt({ userId: 'learner-1' }, priorId);
    expect(stored.revisions.length).toBeGreaterThanOrEqual(1);
    expect(stored.revisions.at(-1).studentText).toBe(validPeel);
    expect(stored.revisions.at(-1).diff).toEqual(expect.objectContaining({ layers: expect.any(Object) }));
  });

  it('rejects revise when the learner has not submitted a new draft', async () => {
    const store = createLocalAttemptStore();
    const practice = await runLearnSkill(
      { ...baseRequest, mode: 'practice', studentText: weakPeel },
      { attemptStore: store }
    );
    await expect(
      runLearnSkill(
        { ...baseRequest, mode: 'revise', attemptId: practice.attemptId, studentText: '' },
        { attemptStore: store }
      )
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('rejects when the prior attempt id is unknown', async () => {
    await expect(
      runLearnSkill(
        { ...baseRequest, mode: 'revise', attemptId: 'does-not-exist' },
        { attemptStore: createNullAttemptStore() }
      )
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });
});

describe('speaking skill path', () => {
  it('practice records the speaking skill and tags the attempt accordingly', async () => {
    const store = createLocalAttemptStore();
    const result = await runLearnSkill(
      {
        ...baseRequest,
        mode: 'practice',
        studentText: validPeel,
        skill: 'speaking',
      },
      { attemptStore: store }
    );

    const stored = store.loadAttempt({ userId: 'learner-1' }, result.attemptId);
    expect(stored.skill).toBe('speaking');
  });
});

describe('learn command wired through the unified pipeline', () => {
  it('dispatches practice via executeCommand and returns a finalized result', async () => {
    const attemptStore = createLocalAttemptStore();
    const execution = await executeCommand(
      {
        command: 'learn',
        input: questionText(),
        mode: 'practice',
        studentText: weakPeel,
        userId: 'learner-pipe',
        memoryStore: createNullMemoryStore(),
      },
      { attemptStore }
    );

    expect(execution.result.ok).toBe(true);
    expect(execution.result.status).toBe('success');
    expect(execution.result.command).toBe('learn');
    expect(execution.result.content).toBe(weakPeel);
    expect(execution.result.feedback).toBeTruthy();
    expect(execution.result.criterionFeedback.criteria).toHaveProperty('TR');
    expect(execution.result.mode).toBe('practice');
    expect(execution.result.retries).toBe(0);
  });

  it('dispatches model via executeCommand with a mocked LLM runtime', async () => {
    const runtime = mockLlmRuntime(validPeel);
    const execution = await executeCommand(
      {
        command: 'learn',
        input: questionText(),
        mode: 'model',
        apiKey: 'sk-test',
        userId: 'learner-pipe',
        memoryStore: createNullMemoryStore(),
      },
      { attemptStore: createNullAttemptStore(), llmRuntime: runtime }
    );

    expect(execution.result.ok).toBe(true);
    expect(execution.result.content).toContain('[P]');
  });

  it('rejects an unknown mode at the pipeline boundary', async () => {
    await expect(
      executeCommand(
        {
          command: 'learn',
          input: questionText(),
          mode: 'telepathy',
          userId: 'learner-pipe',
          memoryStore: createNullMemoryStore(),
        },
        { attemptStore: createNullAttemptStore() }
      )
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });
});

function questionText() {
  return 'Some people think online education can replace traditional classrooms. Do you agree?';
}
