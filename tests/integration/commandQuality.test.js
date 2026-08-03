import { beforeEach, describe, expect, it, vi } from 'vitest';

const llm = vi.hoisted(() => ({
  callLLM: vi.fn(),
  streamLLM: vi.fn(),
}));

vi.mock('../../server/utils/llmClient.js', async (importOriginal) => ({
  ...(await importOriginal()),
  callLLM: llm.callLLM,
  streamLLM: llm.streamLLM,
}));

vi.mock('../../server/memory/userMemory.js', () => ({
  addE2Fuel: vi.fn(),
  getRelevantFuel: vi.fn(() => []),
  getWeaknessReport: vi.fn(() => null),
  recordPeelResult: vi.fn(),
}));

const validPeel = `[P] Physical schooling develops social competence.
[E1] Daily peer negotiation teaches conflict resolution and empathy.
[E2] Students in university seminar rooms form study groups around whiteboards.
[L] Thus, physical schooling supports holistic education.`;

// Same-topic matrix PEEL: the matrix input is "community change" (Society), so
// every PEEL in the fixture must use a Society-consistent concrete scene.
const societyMatrixPeel = `[P] Community festivals strengthen social cohesion.
[E1] Repeated shared activities create trust between neighbours who rarely meet.
[E2] A parent cooks a traditional dish with family members at a neighbourhood festival.
[L] Therefore, community festivals strengthen social cohesion.`;

const validMatrix = `## 命中模型
Model B: Physical Presence vs Virtual — physical contact is the dominant mechanism

## 底层骨架
- Physical contact creates repeated social negotiation.

## 基准 PEEL（对本现象）
${societyMatrixPeel}

## 横向秒杀 ×3
### 题1: Should schools retain face-to-face classes?
${societyMatrixPeel}
### 题2: Does remote work weaken teamwork?
${societyMatrixPeel}
### 题3: Are public spaces important for communities?
${societyMatrixPeel}

## 逻辑同构说明
四组论证共用实体接触促进社会能力的机制，仅替换具体场景。`;
const validWizard = `${[validPeel, validPeel, validPeel].join('\n')}

| 用户细节关键词 | 命中母题 | 推荐节点 | 可横向秒杀的题型举例 |
| --- | --- | --- | --- |
| seminar | education | social contact | online learning |`;

describe('generative command quality policy', () => {
  beforeEach(() => {
    llm.callLLM.mockReset();
  });

  it('repairs malformed PEEL exactly once', async () => {
    llm.callLLM
      .mockResolvedValueOnce({ content: '[P] Incomplete.', usage: null })
      .mockResolvedValueOnce({ content: validPeel, usage: null });
    const { runPeelSkill } = await import('../../server/skills/peelSkill.js');

    const result = await runPeelSkill({ input: 'online education', model: 'fake' });

    expect(llm.callLLM).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('success');
    expect(result.retries).toBe(1);
    expect(result.content).toBe(validPeel);
  });

  it('returns QUALITY_FAILED after one invalid repair', async () => {
    llm.callLLM
      .mockResolvedValueOnce({ content: '[P] Incomplete.', usage: null })
      .mockResolvedValueOnce({ content: '[P] Still incomplete.', usage: null });
    const { runPeelSkill } = await import('../../server/skills/peelSkill.js');

    const result = await runPeelSkill({ input: 'online education', model: 'fake' });

    expect(llm.callLLM).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        status: 'quality_failed',
        code: 'QUALITY_FAILED',
        content: null,
        retries: 1,
      })
    );
  });

  it('does not return ok:true for empty provider output', async () => {
    llm.callLLM.mockResolvedValue({ content: '', usage: null });
    const { runCommand } = await import('../../server/orchestrator.js');

    const result = await runCommand({
      command: 'peel',
      input: 'online education',
      model: 'fake',
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('QUALITY_FAILED');
    expect(llm.callLLM).toHaveBeenCalledTimes(2);
  });

  it('keeps memory, quality finalization, and server-owned runtime on one execution path', async () => {
    llm.callLLM.mockResolvedValueOnce({ content: validPeel, usage: null });
    const memoryStore = {
      getRelevantFuel: vi.fn(() => []),
      getWeaknessReport: vi.fn(() => null),
      recordResult: vi.fn(),
    };
    const llmRuntime = {
      baseUrl: 'https://trusted.example/v1',
      timeoutMs: 1234,
    };
    const { runCommand } = await import('../../server/orchestrator.js');

    const result = await runCommand(
      {
        command: 'peel',
        input: 'online education',
        apiKey: 'sk-test',
        baseUrl: 'https://attacker.example/v1',
        model: 'fake',
        memoryStore,
      },
      { enablePrivateQuestionBank: false, llmRuntime }
    );

    expect(result).toEqual(expect.objectContaining({ ok: true, status: 'success' }));
    expect(memoryStore.recordResult).toHaveBeenCalledOnce();
    expect(llm.callLLM).toHaveBeenCalledWith(
      expect.not.objectContaining({ baseUrl: expect.anything() }),
      llmRuntime
    );
    expect(JSON.stringify(llm.callLLM.mock.calls)).not.toContain('attacker.example');
  });

  it('fails matrix when the required four PEEL units are missing', async () => {
    llm.callLLM
      .mockResolvedValueOnce({ content: validPeel, usage: null })
      .mockResolvedValueOnce({ content: validPeel, usage: null });
    const { runMatrixSkill } = await import('../../server/skills/matrixSkill.js');

    const result = await runMatrixSkill({ input: 'community change', model: 'fake' });

    expect(result.status).toBe('quality_failed');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PEEL_COUNT' }),
      ])
    );
    expect(llm.callLLM).toHaveBeenCalledTimes(2);
  });

  it('accepts a matrix only with exactly four valid PEEL units', async () => {
    llm.callLLM.mockResolvedValueOnce({ content: validMatrix, usage: null });
    const { runMatrixSkill } = await import('../../server/skills/matrixSkill.js');

    const result = await runMatrixSkill({ input: 'community change', model: 'fake' });

    expect(result.status).toBe('success');
    expect(result.parsed.peels).toHaveLength(4);
    expect(llm.callLLM).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'model selection',
      validMatrix.replace(/## 命中模型[\s\S]*?(?=## 底层骨架)/, ''),
      'MATRIX_MODEL',
    ],
    [
      'skeleton',
      validMatrix.replace(/## 底层骨架[\s\S]*?(?=## 基准 PEEL)/, ''),
      'MATRIX_SKELETON',
    ],
    ['baseline heading', validMatrix.replace('## 基准 PEEL（对本现象）\n', ''), 'MATRIX_BASELINE'],
    ['question sections', validMatrix.replace('### 题2: Does remote work weaken teamwork?\n', ''), 'MATRIX_QUESTION_SECTIONS'],
    [
      'logic-isomorphism section',
      validMatrix.replace(/## 逻辑同构说明[\s\S]*$/, ''),
      'MATRIX_LOGIC_ISOMORPHISM',
    ],
  ])('fails matrix without required %s', async (_name, invalidMatrix, issueCode) => {
    llm.callLLM.mockResolvedValue({ content: invalidMatrix, usage: null });
    const { runMatrixSkill } = await import('../../server/skills/matrixSkill.js');

    const result = await runMatrixSkill({ input: 'community change', model: 'fake' });

    expect(result.status).toBe('quality_failed');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: issueCode })])
    );
    expect(llm.callLLM).toHaveBeenCalledTimes(2);
  });

  it('fails wizard generation when scripts or routing table are malformed', async () => {
    llm.callLLM
      .mockResolvedValueOnce({ content: validPeel, usage: null })
      .mockResolvedValueOnce({ content: validPeel, usage: null });
    const { runWizardSkill } = await import('../../server/skills/wizardSkill.js');

    const result = await runWizardSkill({
      input: 'I studied in seminar rooms',
      history: [{ role: 'assistant', content: 'Where did you study?' }],
      model: 'fake',
    });

    expect(result.status).toBe('quality_failed');
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['PEEL_COUNT', 'WIZARD_ROUTING_TABLE'])
    );
  });

  it('accepts three valid wizard scripts plus the routing table', async () => {
    llm.callLLM.mockResolvedValueOnce({ content: validWizard, usage: null });
    const { runWizardSkill } = await import('../../server/skills/wizardSkill.js');

    const result = await runWizardSkill({
      input: 'I studied in seminar rooms',
      history: [{ role: 'assistant', content: 'Where did you study?' }],
      model: 'fake',
    });

    expect(result.status).toBe('success');
    expect(result.parsed.peels).toHaveLength(3);
  });

  it.each([
    [
      'all four routing columns',
      validWizard.replace(' | 可横向秒杀的题型举例', ''),
      'WIZARD_ROUTING_COLUMNS',
    ],
    [
      'at least one routing row',
      validWizard.replace('\n| seminar | education | social contact | online learning |', ''),
      'WIZARD_ROUTING_ROW',
    ],
  ])('fails wizard scripts without %s', async (_name, invalidWizard, issueCode) => {
    llm.callLLM.mockResolvedValue({ content: invalidWizard, usage: null });
    const { runWizardSkill } = await import('../../server/skills/wizardSkill.js');

    const result = await runWizardSkill({
      input: 'I studied in seminar rooms',
      history: [{ role: 'assistant', content: 'Where did you study?' }],
      model: 'fake',
    });

    expect(result.status).toBe('quality_failed');
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: issueCode })])
    );
  });

  it('fails the initial wizard turn when it emits prose alongside questions', async () => {
    const invalidQuestions = `Tell me more about your life.
1. Where did you last study with other students?
2. Which classroom object do you remember most clearly?
3. When did a teacher last change your mind?`;
    llm.callLLM.mockResolvedValue({ content: invalidQuestions, usage: null });
    const { runWizardSkill } = await import('../../server/skills/wizardSkill.js');

    const result = await runWizardSkill({ input: '/wizard', model: 'fake' });

    expect(result.status).toBe('quality_failed');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'WIZARD_QUESTIONS_ONLY' }),
      ])
    );
    expect(llm.callLLM).toHaveBeenCalledTimes(2);
  });
});
