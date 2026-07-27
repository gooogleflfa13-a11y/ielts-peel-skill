import { describe, expect, it } from 'vitest';
import { executeCommand } from '../../server/pipeline/executeCommand.js';

const validPeel = `[P] Physical schooling develops social competence.
[E1] Daily peer negotiation teaches conflict resolution and empathy.
[E2] Students in university seminar rooms form study groups around whiteboards.
[L] Thus, physical schooling supports holistic education.`;

describe('executeCommand', () => {
  it('returns one finalized result and a complete event for sync execution', async () => {
    const execution = await executeCommand({
      command: 'score',
      input: validPeel,
    });

    expect(execution.result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'success',
        command: 'score',
        content: validPeel,
        feedback: expect.any(Object),
        disclaimer: expect.any(String),
      })
    );
    expect(execution.events).toEqual([
      { type: 'complete', result: execution.result },
    ]);
  });

  it('buffers stream output until validation and exposes chunk then complete events', async () => {
    const execution = await executeCommand(
      { command: 'score', input: validPeel },
      { stream: true }
    );

    expect(execution.events).toEqual([
      { type: 'chunk', content: validPeel },
      { type: 'complete', result: execution.result },
    ]);
  });

  it('rejects invalid requests with stable field-level issues', async () => {
    await expect(
      executeCommand({ command: 'score', input: '' })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'INVALID_REQUEST',
        status: 400,
        issues: [expect.objectContaining({ field: 'input' })],
      })
    );
  });
});
