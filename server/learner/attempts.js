function generateId() {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createAttempt(input) {
  const errors = [];
  if (!input?.userId) errors.push('userId is required');
  if (!input?.skill) errors.push('skill is required');
  if (!input?.response) errors.push('response is required');
  if (errors.length > 0) return { ok: false, errors };

  const now = new Date().toISOString();
  const attempt = {
    id: generateId(),
    userId: input.userId,
    skill: input.skill,
    mode: input.mode || 'practice',
    prompt: input.prompt || null,
    createdAt: now,
    updatedAt: now,
    revisions: [
      {
        ts: now,
        response: input.response,
        validation: input.validation || null,
        criterionFeedback: input.criterionFeedback || null,
      },
    ],
  };

  return { ok: true, attempt };
}

export function appendRevision(attempt, revision) {
  const now = new Date().toISOString();
  return {
    ...attempt,
    updatedAt: now,
    revisions: [
      ...attempt.revisions,
      {
        ts: now,
        response: revision.response,
        validation: revision.validation || null,
        criterionFeedback: revision.criterionFeedback || null,
      },
    ],
  };
}

function sanitizeId(id) {
  return String(id || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

export function createNullAttemptStore() {
  return {
    createAttempt() { return null; },
    appendRevision() {},
    loadAttempt() { return null; },
    listAttempts() { return []; },
    deleteAllAttempts() {},
    exportAllAttempts() { return []; },
  };
}

export function createLocalAttemptStore() {
  const byUser = new Map();

  function bucket(userId) {
    const key = sanitizeId(userId);
    let list = byUser.get(key);
    if (!list) {
      list = [];
      byUser.set(key, list);
    }
    return list;
  }

  return {
    createAttempt(context, attempt) {
      const userId = sanitizeId(context?.userId);
      const list = bucket(userId);
      const record = {
        id: generateId(),
        userId,
        skill: attempt?.skill || 'writing',
        question: attempt?.question || '',
        studentText: attempt?.studentText || '',
        feedback: attempt?.feedback || null,
        revisions: [],
        createdAt: new Date().toISOString(),
      };
      list.push(record);
      return record;
    },

    appendRevision(context, attemptId, revision) {
      const list = bucket(context?.userId);
      const record = list.find((a) => a.id === attemptId);
      if (!record) return null;
      const now = new Date().toISOString();
      const entry = {
        ts: now,
        studentText: revision?.studentText ?? null,
        feedback: revision?.feedback ?? null,
        criterionFeedback: revision?.criterionFeedback ?? null,
        validation: revision?.validation ?? null,
        diff: revision?.diff ?? null,
        reScoredAt: now,
      };
      record.revisions.push(entry);
      return entry;
    },

    loadAttempt(context, attemptId) {
      const list = bucket(context?.userId);
      return list.find((a) => a.id === attemptId) || null;
    },

    listAttempts(context) {
      return [...bucket(context?.userId)];
    },

    deleteAllAttempts(context) {
      byUser.delete(sanitizeId(context?.userId));
    },

    exportAllAttempts(context) {
      return [...bucket(context?.userId)];
    },
  };
}
