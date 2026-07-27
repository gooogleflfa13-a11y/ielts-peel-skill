const VALID_TEST_TYPES = ['academic', 'general'];
const VALID_LANGUAGES = ['en', 'zh'];
const MIN_BAND = 5;
const MAX_BAND = 9;

function isIntegerBand(value) {
  return Number.isInteger(value) && value >= MIN_BAND && value <= MAX_BAND;
}

function isIsoDate(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && value === parsed.toISOString();
}

export function validateProfile(input) {
  const errors = [];

  if (!VALID_TEST_TYPES.includes(input?.testType)) {
    errors.push('testType must be "academic" or "general"');
  }

  if (!isIntegerBand(input?.targetBand)) {
    errors.push('targetBand must be an integer from 5 to 9');
  }

  if (!isIntegerBand(input?.currentLevel)) {
    errors.push('currentLevel must be an integer from 5 to 9');
  }

  if (!isIsoDate(input?.examDate)) {
    errors.push('examDate must be an ISO date string or null');
  }

  const language = input?.language ?? 'en';
  if (!VALID_LANGUAGES.includes(language)) {
    errors.push('language must be "en" or "zh"');
  }

  return { ok: errors.length === 0, errors };
}

export function createProfile(input) {
  const { ok, errors } = validateProfile(input);
  if (!ok) return { ok: false, errors };

  const now = new Date().toISOString();
  const profile = {
    testType: input.testType,
    targetBand: input.targetBand,
    currentLevel: input.currentLevel,
    examDate: input.examDate ?? null,
    language: input.language ?? 'en',
    createdAt: now,
    updatedAt: now,
  };

  return { ok: true, profile };
}

function sanitizeId(id) {
  return String(id || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

export function createNullProfileStore() {
  return {
    getProfile() { return null; },
    saveProfile() {},
    deleteProfile() {},
    exportProfile() { return null; },
  };
}

export function createLocalProfileStore() {
  const store = new Map();
  return {
    getProfile(context) {
      return store.get(sanitizeId(context?.userId)) || null;
    },
    saveProfile(context, profile) {
      store.set(sanitizeId(context?.userId), profile);
    },
    deleteProfile(context) {
      store.delete(sanitizeId(context?.userId));
    },
    exportProfile(context) {
      return store.get(sanitizeId(context?.userId)) || null;
    },
  };
}

export function updateProfile(existing, changes) {
  const merged = { ...existing, ...changes };
  const { ok, errors } = validateProfile(merged);
  if (!ok) return { ok: false, errors };

  const profile = {
    ...merged,
    examDate: changes.examDate !== undefined ? changes.examDate : existing.examDate,
    language: changes.language !== undefined ? changes.language : existing.language,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  return { ok: true, profile };
}
