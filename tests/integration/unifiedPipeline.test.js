import { describe, expect, it } from 'vitest';
import { runCommand, runCommandStream } from '../../server/orchestrator.js';

const validPeel = `[P] Physical schooling develops social competence.
[E1] Daily peer negotiation teaches conflict resolution and empathy.
[E2] Students in university seminar rooms form study groups around whiteboards.
[L] Thus, physical schooling supports holistic education.`;

describe('unified command pipeline adapters', () => {
  it('sync and SSE adapters expose the same finalized score result', async () => {
    const syncResult = await runCommand({ command: 'score', input: validPeel });
    const chunks = [];
    const completed = [];

    await runCommandStream({
      command: 'score',
      input: validPeel,
      onChunk: (content) => chunks.push(content),
      onComplete: (result) => completed.push(result),
    });

    expect(chunks).toEqual([validPeel]);
    expect(completed).toHaveLength(1);
    const { latencyMs: syncLatency, ...syncContract } = syncResult;
    const { latencyMs: streamLatency, ...streamContract } = completed[0];
    expect(syncLatency).toEqual(expect.any(Number));
    expect(streamLatency).toEqual(expect.any(Number));
    expect(streamContract).toEqual(syncContract);
    expect(completed[0]).toEqual(
      expect.objectContaining({
        feedback: expect.any(Object),
        disclaimer: expect.any(String),
      })
    );
  });

  it('applies the same INVALID_REQUEST boundary before either adapter executes', async () => {
    await expect(
      runCommand({ command: 'score', input: '' })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'INVALID_REQUEST',
        issues: [expect.objectContaining({ field: 'input' })],
      })
    );

    const errors = [];
    await runCommandStream({
      command: 'score',
      input: '',
      onError: (error) => errors.push(error),
    });
    expect(errors).toEqual([
      expect.objectContaining({
        code: 'INVALID_REQUEST',
        issues: [expect.objectContaining({ field: 'input' })],
      }),
    ]);
  });
});
