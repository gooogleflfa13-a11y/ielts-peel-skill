import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createProfile,
  updateProfile,
  validateProfile,
} from '../../server/learner/profile.js';
import {
  createLocalFileMemoryStore,
  createNullMemoryStore,
} from '../../server/memory/memoryStore.js';

const tempDirs = [];

function createTempMemoryDir() {
  const directory = mkdtempSync(join(tmpdir(), 'peel-profile-'));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Learner Profile', () => {
  describe('validateProfile', () => {
    it('accepts a complete valid academic profile', () => {
      const result = validateProfile({
        testType: 'academic',
        targetBand: 7,
        currentLevel: 5,
        examDate: '2026-12-01T00:00:00.000Z',
        language: 'en',
      });
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts a general training profile with null examDate', () => {
      const result = validateProfile({
        testType: 'general',
        targetBand: 6,
        currentLevel: 6,
        examDate: null,
        language: 'zh',
      });
      expect(result.ok).toBe(true);
    });

    it('rejects an invalid testType', () => {
      const result = validateProfile({
        testType: 'toefl',
        targetBand: 7,
        currentLevel: 5,
        examDate: null,
        language: 'en',
      });
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('testType must be "academic" or "general"');
    });

    it('rejects targetBand below 5 or above 9', () => {
      const low = validateProfile({
        testType: 'academic',
        targetBand: 4,
        currentLevel: 5,
        examDate: null,
        language: 'en',
      });
      expect(low.ok).toBe(false);
      expect(low.errors).toContain('targetBand must be an integer from 5 to 9');

      const high = validateProfile({
        testType: 'academic',
        targetBand: 10,
        currentLevel: 5,
        examDate: null,
        language: 'en',
      });
      expect(high.ok).toBe(false);
    });

    it('rejects non-integer band values', () => {
      const result = validateProfile({
        testType: 'academic',
        targetBand: 7.5,
        currentLevel: 5,
        examDate: null,
        language: 'en',
      });
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('targetBand must be an integer from 5 to 9');
    });

    it('rejects currentLevel outside 5-9', () => {
      const result = validateProfile({
        testType: 'academic',
        targetBand: 7,
        currentLevel: 4,
        examDate: null,
        language: 'en',
      });
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('currentLevel must be an integer from 5 to 9');
    });

    it('rejects an invalid language', () => {
      const result = validateProfile({
        testType: 'academic',
        targetBand: 7,
        currentLevel: 5,
        examDate: null,
        language: 'fr',
      });
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('language must be "en" or "zh"');
    });

    it('rejects a non-ISO examDate string', () => {
      const result = validateProfile({
        testType: 'academic',
        targetBand: 7,
        currentLevel: 5,
        examDate: 'next month',
        language: 'en',
      });
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('examDate must be an ISO date string or null');
    });

    it('accepts a missing examDate by defaulting to null', () => {
      const result = validateProfile({
        testType: 'academic',
        targetBand: 7,
        currentLevel: 5,
        language: 'en',
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('createProfile', () => {
    it('creates a profile with createdAt and updatedAt timestamps', () => {
      const { ok, profile } = createProfile({
        testType: 'academic',
        targetBand: 7,
        currentLevel: 5,
        examDate: '2026-12-01T00:00:00.000Z',
        language: 'en',
      });
      expect(ok).toBe(true);
      expect(profile.testType).toBe('academic');
      expect(profile.targetBand).toBe(7);
      expect(profile.currentLevel).toBe(5);
      expect(profile.examDate).toBe('2026-12-01T00:00:00.000Z');
      expect(profile.language).toBe('en');
      expect(profile.createdAt).toBeTruthy();
      expect(profile.updatedAt).toBeTruthy();
    });

    it('defaults language to en when omitted', () => {
      const { ok, profile } = createProfile({
        testType: 'academic',
        targetBand: 7,
        currentLevel: 5,
      });
      expect(ok).toBe(true);
      expect(profile.language).toBe('en');
    });

    it('defaults examDate to null when omitted', () => {
      const { ok, profile } = createProfile({
        testType: 'general',
        targetBand: 6,
        currentLevel: 6,
      });
      expect(ok).toBe(true);
      expect(profile.examDate).toBeNull();
    });

    it('returns errors without a profile when validation fails', () => {
      const { ok, errors, profile } = createProfile({
        testType: 'invalid',
        targetBand: 3,
        currentLevel: 11,
        language: 'fr',
      });
      expect(ok).toBe(false);
      expect(profile).toBeUndefined();
      expect(errors.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('updateProfile', () => {
    it('updates only the provided fields and refreshes updatedAt', () => {
      const { profile: original } = createProfile({
        testType: 'academic',
        targetBand: 6,
        currentLevel: 5,
        examDate: null,
        language: 'en',
      });
      const before = original.updatedAt;

      const { ok, profile } = updateProfile(original, { targetBand: 7 });
      expect(ok).toBe(true);
      expect(profile.targetBand).toBe(7);
      expect(profile.testType).toBe('academic');
      expect(profile.currentLevel).toBe(5);
      expect(new Date(profile.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(before).getTime()
      );
    });

    it('validates the merged result', () => {
      const { profile: original } = createProfile({
        testType: 'academic',
        targetBand: 6,
        currentLevel: 5,
      });
      const { ok, errors } = updateProfile(original, { targetBand: 99 });
      expect(ok).toBe(false);
      expect(errors).toContain('targetBand must be an integer from 5 to 9');
    });

    it('preserves createdAt from the original profile', () => {
      const { profile: original } = createProfile({
        testType: 'academic',
        targetBand: 6,
        currentLevel: 5,
      });
      const { profile } = updateProfile(original, { currentLevel: 6 });
      expect(profile.createdAt).toBe(original.createdAt);
    });
  });
});

describe('MemoryStore profile methods', () => {
  it('null store returns null for getProfile and no-ops saveProfile', async () => {
    const store = createNullMemoryStore();
    expect(await store.getProfile({ userId: 'default' })).toBeNull();
    await store.saveProfile({ userId: 'default' }, {
      testType: 'academic',
      targetBand: 7,
    });
    expect(await store.getProfile({ userId: 'default' })).toBeNull();
  });

  it('local store persists and returns a profile', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    const context = { userId: 'learner-1' };
    const { profile } = createProfile({
      testType: 'academic',
      targetBand: 7,
      currentLevel: 5,
      examDate: '2026-12-01T00:00:00.000Z',
      language: 'en',
    });

    await store.saveProfile(context, profile);
    const loaded = await store.getProfile(context);

    expect(loaded).toMatchObject({
      testType: 'academic',
      targetBand: 7,
      currentLevel: 5,
      examDate: '2026-12-01T00:00:00.000Z',
      language: 'en',
    });
  });

  it('local store returns null when no profile exists', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    expect(await store.getProfile({ userId: 'new-user' })).toBeNull();
  });

  it('local store overwrites profile on re-save (profile is singleton)', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    const context = { userId: 'learner-2' };

    const { profile: first } = createProfile({
      testType: 'academic',
      targetBand: 6,
      currentLevel: 5,
    });
    await store.saveProfile(context, first);

    const { profile: updated } = updateProfile(first, { targetBand: 7 });
    await store.saveProfile(context, updated);

    const loaded = await store.getProfile(context);
    expect(loaded.targetBand).toBe(7);
  });

  it('local store preserves existing memory schema fields alongside profile', async () => {
    const memoryDir = createTempMemoryDir();
    const store = createLocalFileMemoryStore({ memoryDir });
    const context = { userId: 'learner-3' };

    await store.addE2Fuel(context, {
      topic: 'Education',
      entity: 'a campus library',
      sourceAnswer: 'I revise there.',
    });
    const { profile } = createProfile({
      testType: 'academic',
      targetBand: 7,
      currentLevel: 5,
    });
    await store.saveProfile(context, profile);

    const saved = JSON.parse(readFileSync(join(memoryDir, 'learner-3.json'), 'utf8'));
    expect(saved.e2Fuel).toHaveLength(1);
    expect(saved.profile).toMatchObject({ testType: 'academic', targetBand: 7 });
  });
});
