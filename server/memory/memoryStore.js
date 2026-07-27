import {
  addE2Fuel,
  deleteAllAttempts,
  exportAllAttempts,
  getAttempt,
  getProfile,
  getRelevantFuel,
  getUserMemory,
  getWeaknessReport,
  listAttempts,
  recordPeelResult,
  saveAttempt,
  saveProfile,
  saveUserMemory,
} from './userMemory.js';

export function createNullMemoryStore() {
  return {
    getRelevantFuel() {
      return [];
    },
    getWeaknessReport() {
      return null;
    },
    addE2Fuel() {},
    recordResult() {},
    getProfile() {
      return null;
    },
    saveProfile() {},
    getAttempt() {
      return null;
    },
    saveAttempt() {},
    listAttempts() {
      return [];
    },
    deleteAllAttempts() {},
    exportAllAttempts() {
      return [];
    },
    exportLearnerData() {
      return { e2Fuel: [], weaknesses: {}, stats: {} };
    },
    clearLearnerData() {},
  };
}

function toTypedFacts(rawFuel) {
  return (rawFuel || []).map((f) => ({
    type: 'e2_fuel',
    topic: f.topic,
    entity: f.entity,
  }));
}

export function createLocalFileMemoryStore({ memoryDir } = {}) {
  return {
    getRelevantFuel(context, topicId) {
      return toTypedFacts(getRelevantFuel(context?.userId, topicId, memoryDir));
    },
    getWeaknessReport(context) {
      return getWeaknessReport(context?.userId, memoryDir);
    },
    addE2Fuel(context, fact) {
      return addE2Fuel(context?.userId, fact, memoryDir);
    },
    recordResult(context, result) {
      return recordPeelResult(context?.userId, result, memoryDir);
    },
    getProfile(context) {
      return getProfile(context?.userId, memoryDir);
    },
    saveProfile(context, profile) {
      return saveProfile(context?.userId, profile, memoryDir);
    },
    getAttempt(context, attemptId) {
      return getAttempt(context?.userId, attemptId, memoryDir);
    },
    saveAttempt(context, attempt) {
      return saveAttempt(context?.userId, attempt, memoryDir);
    },
    listAttempts(context) {
      return listAttempts(context?.userId, memoryDir);
    },
    deleteAllAttempts(context) {
      return deleteAllAttempts(context?.userId, memoryDir);
    },
    exportAllAttempts(context) {
      return exportAllAttempts(context?.userId, memoryDir);
    },
    exportLearnerData(context) {
      const mem = getUserMemory(context?.userId, memoryDir);
      return {
        e2Fuel: mem.e2Fuel || [],
        weaknesses: mem.weaknesses || {},
        stats: mem.stats || {},
      };
    },
    clearLearnerData(context) {
      saveUserMemory(context?.userId, {
        userId: context?.userId || 'default',
        createdAt: new Date().toISOString(),
        e2Fuel: [],
        scripts: [],
        stats: { totalPeels: 0, totalMatrices: 0, totalWizards: 0, topTopics: {}, avgValidationScore: 0 },
        weaknesses: {},
      }, memoryDir);
    },
  };
}
