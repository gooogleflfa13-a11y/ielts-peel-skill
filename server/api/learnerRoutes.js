import { Router } from 'express';
import { createNullAttemptStore } from '../learner/attempts.js';
import { createNullProfileStore } from '../learner/profile.js';
import { createNullMemoryStore } from '../memory/memoryStore.js';
import { log } from '../utils/logger.js';

const VALID_TEST_TYPES = ['academic', 'general'];
const VALID_LANGUAGES = ['en', 'zh'];

function isLooseDate(value) {
  if (value === null || value === undefined || value === '') return true;
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function validateProfilePayload(profile) {
  const errors = [];
  if (!VALID_TEST_TYPES.includes(profile?.testType)) {
    errors.push('testType must be "academic" or "general"');
  }
  if (!Number.isInteger(profile?.targetBand) || profile.targetBand < 5 || profile.targetBand > 9) {
    errors.push('targetBand must be an integer from 5 to 9');
  }
  if (!Number.isInteger(profile?.currentLevel) || profile.currentLevel < 5 || profile.currentLevel > 9) {
    errors.push('currentLevel must be an integer from 5 to 9');
  }
  if (!isLooseDate(profile?.examDate)) {
    errors.push('examDate must be a valid date string or null');
  }
  if (profile?.language !== undefined && !VALID_LANGUAGES.includes(profile.language)) {
    errors.push('language must be "en" or "zh"');
  }
  return errors;
}

/**
 * Phase 2 privacy API - learner data export and deletion.
 *
 * Endpoints:
 *  - GET    /api/learner/export  -> { userId, profile, attempts, fuel }
 *  - DELETE /api/learner/data    -> { userId, removed: true }
 *
 * The learner id is taken from the `x-learner-id` header (default 'default').
 * In local mode the stores are real; in public mode they are null stores that
 * never persist, so export returns an empty payload and delete is a no-op.
 *
 * Composition: the router clears/exports across three stores - profile
 * (Task 1, Core), attempts (Task 2, Core), and the existing memory store
 * (e2Fuel + weaknesses). Integration will fold the profile/attempt stubs into
 * the MemoryStore interface without changing this router's contract.
 */
export function createLearnerRouter({
  memoryStore = createNullMemoryStore(),
  attemptStore = createNullAttemptStore(),
  profileStore = createNullProfileStore(),
} = {}) {
  const router = Router();

  function learnerId(req) {
    const id = req.get('x-learner-id');
    return typeof id === 'string' && id.trim() ? id.trim().slice(0, 64) : 'default';
  }

  router.post('/profile', async (req, res, next) => {
    try {
      const userId = learnerId(req);
      const profile = req.body?.profile;
      if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
        return res
          .status(400)
          .json({ code: 'INVALID_REQUEST', error: 'A profile object is required.' });
      }
      const errors = validateProfilePayload(profile);
      if (errors.length > 0) {
        return res.status(400).json({ code: 'INVALID_REQUEST', errors });
      }
      profileStore.saveProfile({ userId }, profile);
      log('INFO', 'learner.profile.saved', { userId });
      res.json({ profile });
    } catch (error) {
      next(error);
    }
  });

  router.get('/profile', async (req, res, next) => {
    try {
      const userId = learnerId(req);
      const profile = profileStore.getProfile({ userId });
      res.json({ profile });
    } catch (error) {
      next(error);
    }
  });

  router.get('/export', async (req, res, next) => {
    try {
      const userId = learnerId(req);
      const context = { userId };
      const [profile, attempts, fuelData] = await Promise.all([
        Promise.resolve(profileStore.exportProfile(context)),
        Promise.resolve(attemptStore.exportAllAttempts(context)),
        memoryStore.exportLearnerData
          ? Promise.resolve(memoryStore.exportLearnerData(context))
          : Promise.resolve({ e2Fuel: [], weaknesses: {}, stats: {} }),
      ]);

      res.json({
        userId,
        profile,
        attempts,
        fuel: fuelData?.e2Fuel || [],
        weaknesses: fuelData?.weaknesses || {},
        stats: fuelData?.stats || {},
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/data', async (req, res, next) => {
    try {
      const userId = learnerId(req);
      const context = { userId };
      await Promise.all([
        Promise.resolve(attemptStore.deleteAllAttempts(context)),
        Promise.resolve(profileStore.deleteProfile(context)),
        memoryStore.clearLearnerData
          ? Promise.resolve(memoryStore.clearLearnerData(context))
          : Promise.resolve(),
      ]);

      log('INFO', 'learner.data.deleted', { userId });
      res.json({ userId, removed: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
