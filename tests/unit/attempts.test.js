import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  appendRevision,
  createAttempt,
} from '../../server/learner/attempts.js';
import {
  createLocalFileMemoryStore,
  createNullMemoryStore,
} from '../../server/memory/memoryStore.js';

const tempDirs = [];

function createTempMemoryDir() {
  const directory = mkdtempSync(join(tmpdir(), 'peel-attempts-'));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Learner Attempts', () => {
  describe('createAttempt', () => {
    it('creates an attempt with an initial revision', () => {
      const { ok, attempt } = createAttempt({
        userId: 'learner-1',
        skill: 'peel',
        mode: 'practice',
        prompt: 'Write about education',
        response: '[P] Education matters.\n[E1] It builds skills.\n[E2] In a Tokyo classroom, students use whiteboards.\n[L] Thus, education is vital.',
        validation: { passed: true, checks: {}, issues: [], warnings: [] },
      });
      expect(ok).toBe(true);
      expect(attempt.id).toMatch(/^att_/);
      expect(attempt.userId).toBe('learner-1');
      expect(attempt.skill).toBe('peel');
      expect(attempt.mode).toBe('practice');
      expect(attempt.revisions).toHaveLength(1);
      expect(attempt.revisions[0].response).toContain('[P] Education matters');
      expect(attempt.createdAt).toBeTruthy();
      expect(attempt.updatedAt).toBeTruthy();
    });

    it('requires a userId', () => {
      const { ok, errors } = createAttempt({
        skill: 'peel',
        mode: 'practice',
        prompt: 'x',
        response: 'y',
      });
      expect(ok).toBe(false);
      expect(errors).toContain('userId is required');
    });

    it('requires a skill', () => {
      const { ok, errors } = createAttempt({
        userId: 'u1',
        mode: 'practice',
        prompt: 'x',
        response: 'y',
      });
      expect(ok).toBe(false);
      expect(errors).toContain('skill is required');
    });

    it('requires a response', () => {
      const { ok, errors } = createAttempt({
        userId: 'u1',
        skill: 'peel',
        mode: 'practice',
        prompt: 'x',
        response: '',
      });
      expect(ok).toBe(false);
      expect(errors).toContain('response is required');
    });
  });

  describe('appendRevision', () => {
    it('appends a new revision without mutating the original', () => {
      const { attempt: original } = createAttempt({
        userId: 'u1',
        skill: 'peel',
        mode: 'revise',
        prompt: 'p',
        response: 'first response',
      });
      const originalLength = original.revisions.length;

      const updated = appendRevision(original, {
        response: 'revised response',
        validation: { passed: false },
      });

      expect(updated.revisions).toHaveLength(originalLength + 1);
      expect(updated.revisions[updated.revisions.length - 1].response).toBe(
        'revised response'
      );
      expect(original.revisions).toHaveLength(originalLength);
    });

    it('refreshes updatedAt on append', () => {
      const { attempt: original } = createAttempt({
        userId: 'u1',
        skill: 'peel',
        mode: 'revise',
        prompt: 'p',
        response: 'first',
      });
      const updated = appendRevision(original, { response: 'second' });
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.updatedAt).getTime()
      );
    });

    it('preserves all prior revisions in order', () => {
      const { attempt: a1 } = createAttempt({
        userId: 'u1',
        skill: 'peel',
        mode: 'revise',
        prompt: 'p',
        response: 'rev-0',
      });
      const a2 = appendRevision(a1, { response: 'rev-1' });
      const a3 = appendRevision(a2, { response: 'rev-2' });

      const responses = a3.revisions.map((r) => r.response);
      expect(responses).toEqual(['rev-0', 'rev-1', 'rev-2']);
    });
  });
});

describe('MemoryStore attempt methods', () => {
  it('null store returns null for getAttempt and empty list', async () => {
    const store = createNullMemoryStore();
    expect(await store.getAttempt({ userId: 'u1' }, 'att_1')).toBeNull();
    expect(await store.listAttempts({ userId: 'u1' })).toEqual([]);
    expect(await store.exportAllAttempts({ userId: 'u1' })).toEqual([]);
    await store.saveAttempt({ userId: 'u1' }, { id: 'att_1' });
    await store.deleteAllAttempts({ userId: 'u1' });
  });

  it('local store saves and loads an attempt by ID', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    const context = { userId: 'learner-1' };
    const { attempt } = createAttempt({
      userId: 'learner-1',
      skill: 'peel',
      mode: 'practice',
      prompt: 'p',
      response: 'r',
    });

    await store.saveAttempt(context, attempt);
    const loaded = await store.getAttempt(context, attempt.id);

    expect(loaded).toMatchObject({ id: attempt.id, skill: 'peel' });
    expect(loaded.revisions).toHaveLength(1);
  });

  it('local store returns null for unknown attempt ID', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    expect(await store.getAttempt({ userId: 'u1' }, 'att_missing')).toBeNull();
  });

  it('local store lists attempts by user', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    const context = { userId: 'learner-2' };

    const { attempt: a1 } = createAttempt({
      userId: 'learner-2',
      skill: 'peel',
      mode: 'practice',
      prompt: 'p1',
      response: 'r1',
    });
    const { attempt: a2 } = createAttempt({
      userId: 'learner-2',
      skill: 'matrix',
      mode: 'model',
      prompt: 'p2',
      response: 'r2',
    });
    await store.saveAttempt(context, a1);
    await store.saveAttempt(context, a2);

    const list = await store.listAttempts(context);
    expect(list).toHaveLength(2);
    expect(list.map((a) => a.skill).sort()).toEqual(['matrix', 'peel']);
  });

  it('local store isolates attempts by user', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });

    const { attempt: a1 } = createAttempt({
      userId: 'user-a',
      skill: 'peel',
      mode: 'practice',
      prompt: 'p',
      response: 'r',
    });
    await store.saveAttempt({ userId: 'user-a' }, a1);

    expect(await store.listAttempts({ userId: 'user-b' })).toEqual([]);
  });

  it('enforces append-only: saving an updated attempt preserves all revisions', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    const context = { userId: 'learner-3' };

    const { attempt: original } = createAttempt({
      userId: 'learner-3',
      skill: 'peel',
      mode: 'revise',
      prompt: 'p',
      response: 'rev-0',
    });
    await store.saveAttempt(context, original);

    const updated = appendRevision(original, { response: 'rev-1' });
    await store.saveAttempt(context, updated);

    const loaded = await store.getAttempt(context, original.id);
    expect(loaded.revisions).toHaveLength(2);
    expect(loaded.revisions.map((r) => r.response)).toEqual(['rev-0', 'rev-1']);
  });

  it('deleteAllAttempts removes all attempts for a user', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    const context = { userId: 'learner-4' };

    const { attempt: a1 } = createAttempt({
      userId: 'learner-4',
      skill: 'peel',
      mode: 'practice',
      prompt: 'p',
      response: 'r',
    });
    await store.saveAttempt(context, a1);
    expect(await store.listAttempts(context)).toHaveLength(1);

    await store.deleteAllAttempts(context);
    expect(await store.listAttempts(context)).toEqual([]);
    expect(await store.getAttempt(context, a1.id)).toBeNull();
  });

  it('deleteAllAttempts preserves profile and fuel', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    const context = { userId: 'learner-5' };

    await store.addE2Fuel(context, {
      topic: 'Education',
      entity: 'a library',
      sourceAnswer: 'I study there.',
    });
    const { attempt } = createAttempt({
      userId: 'learner-5',
      skill: 'peel',
      mode: 'practice',
      prompt: 'p',
      response: 'r',
    });
    await store.saveAttempt(context, attempt);
    await store.deleteAllAttempts(context);

    const saved = JSON.parse(readFileSync(join(memoryDir, 'learner-5.json'), 'utf8'));
    expect(saved.e2Fuel).toHaveLength(1);
    expect(saved.attempts).toEqual({});
  });

  it('exportAllAttempts returns a serializable copy without internal metadata', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    const context = { userId: 'learner-6' };

    const { attempt } = createAttempt({
      userId: 'learner-6',
      skill: 'peel',
      mode: 'practice',
      prompt: 'p',
      response: 'r',
    });
    await store.saveAttempt(context, attempt);

    const exported = await store.exportAllAttempts(context);
    expect(exported).toHaveLength(1);
    expect(exported[0]).toMatchObject({ id: attempt.id, skill: 'peel' });
    expect(JSON.parse(JSON.stringify(exported))).toEqual(exported);
  });

  it('exportAllAttempts returns empty for a user with no attempts', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    expect(await store.exportAllAttempts({ userId: 'nobody' })).toEqual([]);
  });
});
