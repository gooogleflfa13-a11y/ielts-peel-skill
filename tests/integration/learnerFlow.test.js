import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { createNullMemoryStore, createLocalFileMemoryStore } from '../../server/memory/memoryStore.js';
import {
  createNullAttemptStore,
  createLocalAttemptStore,
} from '../../server/learner/attempts.js';
import {
  createNullProfileStore,
  createLocalProfileStore,
} from '../../server/learner/profile.js';
import { runLearnSkill } from '../../server/learner/learnSkill.js';

function config(overrides = {}) {
  return {
    appMode: 'local',
    providerBaseUrl: 'https://api.openai.com/v1',
    upstreamTimeoutMs: 30_000,
    corsOrigins: [],
    trustProxyHops: 0,
    metricsToken: null,
    enableLocalMemory: false,
    enablePrivateQuestionBank: false,
    ...overrides,
  };
}

const question = 'Some people think online education can replace traditional classrooms. Do you agree?';
const studentPeel = `[P] Physical schooling develops social competence.
[E1] Daily peer negotiation teaches conflict resolution and empathy.
[E2] Students in university seminar rooms form study groups around whiteboards.
[L] Thus, physical schooling supports holistic education.`;

describe('Privacy API - null stores', () => {
  it('GET /api/learner/export returns an empty payload with null stores', async () => {
    const app = createApp({
      config: config(),
      memoryStore: createNullMemoryStore(),
      attemptStore: createNullAttemptStore(),
      profileStore: createNullProfileStore(),
      runCommand: vi.fn(),
      runCommandStream: vi.fn(),
      getMetrics: vi.fn(() => ({})),
    });

    const res = await request(app).get('/api/learner/export').set('x-learner-id', 'nobody');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        userId: 'nobody',
        profile: null,
        attempts: [],
        fuel: [],
      })
    );
  });

  it('DELETE /api/learner/data is a no-op and returns 200 with null stores', async () => {
    const app = createApp({
      config: config(),
      memoryStore: createNullMemoryStore(),
      attemptStore: createNullAttemptStore(),
      profileStore: createNullProfileStore(),
      runCommand: vi.fn(),
      runCommandStream: vi.fn(),
      getMetrics: vi.fn(() => ({})),
    });

    const res = await request(app).delete('/api/learner/data').set('x-learner-id', 'nobody');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ userId: 'nobody', removed: true })
    );
  });
});

describe('Privacy API - local stores', () => {
  function localApp() {
    const memoryStore = createLocalFileMemoryStore();
    const attemptStore = createLocalAttemptStore();
    const profileStore = createLocalProfileStore();
    const app = createApp({
      config: config(),
      memoryStore,
      attemptStore,
      profileStore,
      runCommand: vi.fn(),
      runCommandStream: vi.fn(),
      getMetrics: vi.fn(() => ({})),
    });
    return { app, memoryStore, attemptStore, profileStore };
  }

  it('export returns seeded profile, attempts, and fuel', async () => {
    const { app, attemptStore, profileStore, memoryStore } = localApp();

    profileStore.saveProfile({ userId: 'learner-9' }, {
      testType: 'academic',
      targetBand: 7,
      currentLevel: 6,
      examDate: '2026-12-01',
      language: 'en',
    });
    await runLearnSkill(
      { input: question, mode: 'practice', studentText: studentPeel, userId: 'learner-9', memoryStore },
      { attemptStore }
    );
    await memoryStore.addE2Fuel({ userId: 'learner-9' }, { topic: 'Education', entity: 'a campus library', sourceAnswer: 'I revise there.' });

    const res = await request(app).get('/api/learner/export').set('x-learner-id', 'learner-9');

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('learner-9');
    expect(res.body.profile).toMatchObject({ targetBand: 7, testType: 'academic' });
    expect(res.body.attempts).toHaveLength(1);
    expect(res.body.attempts[0]).toMatchObject({ studentText: studentPeel, skill: 'writing' });
    expect(res.body.fuel).toEqual(
      expect.arrayContaining([expect.objectContaining({ entity: 'a campus library' })])
    );
  });

  it('saves and retrieves a learner profile through the public profile routes', async () => {
    const { app } = localApp();
    const profile = {
      testType: 'academic',
      targetBand: 7,
      currentLevel: 6,
      examDate: '2026-12-01',
      language: 'en',
      skill: 'writing',
    };

    const saved = await request(app)
      .post('/api/learner/profile')
      .set('x-learner-id', 'learner-9')
      .send({ profile });
    expect(saved.status).toBe(200);
    expect(saved.body.profile).toMatchObject(profile);

    const fetched = await request(app)
      .get('/api/learner/profile')
      .set('x-learner-id', 'learner-9');
    expect(fetched.status).toBe(200);
    expect(fetched.body.profile).toMatchObject(profile);
  });

  it('DELETE removes all seeded learner data', async () => {
    const { app, attemptStore, profileStore, memoryStore } = localApp();

    profileStore.saveProfile({ userId: 'learner-9' }, { targetBand: 7 });
    await runLearnSkill(
      { input: question, mode: 'practice', studentText: studentPeel, userId: 'learner-9', memoryStore },
      { attemptStore }
    );
    await memoryStore.addE2Fuel({ userId: 'learner-9' }, { topic: 'Education', entity: 'a campus library', sourceAnswer: 'I revise there.' });

    const before = await request(app).get('/api/learner/export').set('x-learner-id', 'learner-9');
    expect(before.body.attempts).toHaveLength(1);
    expect(before.body.fuel.length).toBeGreaterThanOrEqual(1);

    const del = await request(app).delete('/api/learner/data').set('x-learner-id', 'learner-9');
    expect(del.status).toBe(200);
    expect(del.body).toMatchObject({ userId: 'learner-9', removed: true });

    const after = await request(app).get('/api/learner/export').set('x-learner-id', 'learner-9');
    expect(after.status).toBe(200);
    expect(after.body.profile).toBeNull();
    expect(after.body.attempts).toEqual([]);
    expect(after.body.fuel).toEqual([]);
  });

  it('isolates data per learner id', async () => {
    const { app, attemptStore, profileStore, memoryStore } = localApp();

    await runLearnSkill(
      { input: question, mode: 'practice', studentText: studentPeel, userId: 'a', memoryStore },
      { attemptStore }
    );
    await runLearnSkill(
      { input: question, mode: 'practice', studentText: studentPeel, userId: 'b', memoryStore },
      { attemptStore }
    );

    const del = await request(app).delete('/api/learner/data').set('x-learner-id', 'a');
    expect(del.status).toBe(200);

    const aExport = await request(app).get('/api/learner/export').set('x-learner-id', 'a');
    const bExport = await request(app).get('/api/learner/export').set('x-learner-id', 'b');
    expect(aExport.body.attempts).toEqual([]);
    expect(bExport.body.attempts).toHaveLength(1);
  });
});
