import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createLocalFileMemoryStore,
  createNullMemoryStore,
} from '../../server/memory/memoryStore.js';

const tempDirs = [];

function createTempMemoryDir() {
  const directory = mkdtempSync(join(tmpdir(), 'peel-memory-'));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('MemoryStore', () => {
  it('null store never persists or returns cross-request data', async () => {
    const store = createNullMemoryStore();

    await store.addE2Fuel(
      { userId: 'default' },
      { topic: 'Education', sourceAnswer: 'private' }
    );
    await store.recordResult(
      { userId: 'default' },
      {
        source: 'learner',
        validation: { allWarnings: ['E2 lacks a physical entity'] },
      }
    );

    expect(await store.getRelevantFuel({ userId: 'default' }, 'Education')).toEqual([]);
    expect(await store.getWeaknessReport({ userId: 'default' })).toBeNull();
  });

  it('local store reads the existing JSON memory schema', async () => {
    const memoryDir = createTempMemoryDir();
    writeFileSync(
      join(memoryDir, 'legacy.json'),
      JSON.stringify({
        userId: 'legacy',
        createdAt: '2026-01-01T00:00:00.000Z',
        e2Fuel: [
          {
            topic: 'Education',
            entity: 'a classroom whiteboard',
            sourceQuestion: 'wizard-turn',
            sourceAnswer: 'I studied with a whiteboard.',
            ts: 1,
          },
        ],
        scripts: [],
        stats: {
          totalPeels: 2,
          totalMatrices: 1,
          totalWizards: 1,
          topTopics: { Education: 4 },
          avgValidationScore: 0,
        },
        weaknesses: { E2: 2 },
      })
    );
    const store = createLocalFileMemoryStore({ memoryDir });

    expect(await store.getRelevantFuel({ userId: 'legacy' }, 'Education')).toEqual([
      expect.objectContaining({ entity: 'a classroom whiteboard' }),
    ]);
    expect(await store.getWeaknessReport({ userId: 'legacy' })).toEqual(
      expect.objectContaining({ weaknesses: { E2: 2 } })
    );
  });

  it('local store preserves the existing JSON shape when adding learner fuel', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });

    await store.addE2Fuel(
      { userId: 'learner-1' },
      {
        topic: 'Education',
        entity: 'a campus library',
        sourceQuestion: 'wizard-turn',
        sourceAnswer: 'I revise in the campus library.',
      }
    );

    const saved = JSON.parse(readFileSync(join(memoryDir, 'learner-1.json'), 'utf8'));
    expect(saved).toMatchObject({
      userId: 'learner-1',
      e2Fuel: [expect.objectContaining({ entity: 'a campus library' })],
      scripts: [],
      stats: expect.objectContaining({ totalPeels: 0, totalMatrices: 0, totalWizards: 0 }),
      weaknesses: {},
    });
  });

  it('does not turn generated-agent warnings into learner weaknesses', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    const context = { userId: 'learner-2' };

    await store.recordResult(context, {
      source: 'agent',
      topicId: 'Education',
      command: 'peel',
      validation: { allWarnings: ['E2 lacks a physical entity'] },
    });

    expect(await store.getWeaknessReport(context)).toBeNull();

    await store.recordResult(context, {
      source: 'learner',
      topicId: 'Education',
      command: 'score',
      validation: { allWarnings: ['E2 lacks a physical entity'] },
    });

    expect(await store.getWeaknessReport(context)).toEqual(
      expect.objectContaining({ weaknesses: { E2: 1 } })
    );
    const saved = JSON.parse(readFileSync(join(memoryDir, 'learner-2.json'), 'utf8'));
    expect(saved.stats.totalPeels).toBe(1);
  });

  it('removes direct file-memory imports from execution modules', () => {
    for (const relativePath of [
      '../../server/skills/peelSkill.js',
      '../../server/skills/matrixSkill.js',
      '../../server/skills/wizardSkill.js',
      '../../server/orchestrator.js',
    ]) {
      const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
      expect(source).not.toContain('memory/userMemory.js');
    }
  });
});
