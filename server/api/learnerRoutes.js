import { Router } from 'express';
import { createNullAttemptStore } from '../learner/attempts.js';
import { createNullProfileStore } from '../learner/profile.js';
import { createNullMemoryStore } from '../memory/memoryStore.js';
import { log } from '../utils/logger.js';

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
