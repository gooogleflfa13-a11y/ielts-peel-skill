import {
  addE2Fuel,
  getRelevantFuel,
  getWeaknessReport,
  recordPeelResult,
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
  };
}
