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

function chunksOf(...chunks) {
  return (async function* generate() {
    for (const chunk of chunks) yield chunk;
  })();
}

describe('buffered PEEL streaming', () => {
  beforeEach(() => {
    llm.callLLM.mockReset();
    llm.streamLLM.mockReset();
  });

  it('hides an invalid first attempt and emits the repaired answer once', async () => {
    llm.streamLLM.mockReturnValue(chunksOf('[P] ', 'Incomplete.'));
    llm.callLLM.mockResolvedValue({ content: validPeel, usage: null });
    const { runCommandStream } = await import('../../server/orchestrator.js');
    const chunks = [];
    const completes = [];

    await runCommandStream({
      command: 'peel',
      input: 'online education',
      model: 'fake',
      onChunk: (chunk) => chunks.push(chunk),
      onComplete: (result) => completes.push(result),
    });

    expect(chunks).toEqual([validPeel]);
    expect(chunks.join('')).not.toContain('Incomplete');
    expect(completes).toHaveLength(1);
    expect(completes[0]).toEqual(
      expect.objectContaining({ status: 'success', content: validPeel, retries: 1 })
    );
  });

  it('emits only a stable quality error after the repair also fails', async () => {
    llm.streamLLM.mockReturnValue(chunksOf('[P] Incomplete.'));
    llm.callLLM.mockResolvedValue({ content: '[P] Still incomplete.', usage: null });
    const { runCommandStream } = await import('../../server/orchestrator.js');
    const chunks = [];
    const completes = [];
    const errors = [];

    await runCommandStream({
      command: 'peel',
      input: 'online education',
      model: 'fake',
      onChunk: (chunk) => chunks.push(chunk),
      onComplete: (result) => completes.push(result),
      onError: (error) => errors.push(error),
    });

    expect(chunks).toEqual([]);
    expect(completes).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual(
      expect.objectContaining({ code: 'QUALITY_FAILED', status: 422 })
    );
    expect(errors[0].message).toBe('Generated output failed the PEEL quality contract.');
  });

  it('passes caller cancellation to provider work', async () => {
    const controller = new AbortController();
    let providerSignal;
    llm.streamLLM.mockImplementation((_options, runtime) => {
      providerSignal = runtime.signal;
      return (async function* waitForAbort() {
        await new Promise((resolve) =>
          providerSignal.addEventListener('abort', resolve, { once: true })
        );
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      })();
    });
    const { runCommandStream } = await import('../../server/orchestrator.js');
    const errors = [];

    const pending = runCommandStream({
      command: 'peel',
      input: 'online education',
      model: 'fake',
      signal: controller.signal,
      onError: (error) => errors.push(error),
    });
    await vi.waitFor(() => expect(providerSignal).toBe(controller.signal));
    controller.abort();
    await pending;

    expect(providerSignal.aborted).toBe(true);
    expect(errors).toEqual([]);
  });
});
