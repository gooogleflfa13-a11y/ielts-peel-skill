import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = join(__dirname, '../../.memory');

export function ensureMemoryDir() {
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });
}

function createEmptyMemory(userId) {
  return {
    userId,
    createdAt: new Date().toISOString(),
    e2Fuel: [],
    scripts: [],
    stats: {
      totalPeels: 0,
      totalMatrices: 0,
      totalWizards: 0,
      topTopics: {},
      avgValidationScore: 0,
    },
    weaknesses: {},
  };
}

export function getUserMemory(userId = 'default') {
  ensureMemoryDir();
  const path = join(MEMORY_DIR, `${sanitizeId(userId)}.json`);
  if (!existsSync(path)) return createEmptyMemory(userId);
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return createEmptyMemory(userId);
  }
}

export function saveUserMemory(userId, memory) {
  ensureMemoryDir();
  writeFileSync(
    join(MEMORY_DIR, `${sanitizeId(userId)}.json`),
    JSON.stringify(memory, null, 2)
  );
}

function sanitizeId(id) {
  return String(id || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

export function addE2Fuel(userId, { topic, entity, sourceQuestion, sourceAnswer }) {
  const mem = getUserMemory(userId);
  mem.e2Fuel.push({
    topic,
    entity,
    sourceQuestion,
    sourceAnswer,
    ts: Date.now(),
  });
  if (mem.e2Fuel.length > 200) mem.e2Fuel = mem.e2Fuel.slice(-200);
  saveUserMemory(userId, mem);
}

export function recordPeelResult(userId, { topicId, validation, command = 'peel' }) {
  const mem = getUserMemory(userId);
  if (command === 'matrix') mem.stats.totalMatrices += 1;
  else if (command === 'wizard') mem.stats.totalWizards += 1;
  else mem.stats.totalPeels += 1;

  if (topicId) {
    mem.stats.topTopics[topicId] = (mem.stats.topTopics[topicId] || 0) + 1;
  }

  if (validation?.allWarnings) {
    for (const warn of validation.allWarnings) {
      if (/\bP\b/.test(warn) || warn.includes('P ')) {
        mem.weaknesses.P = (mem.weaknesses.P || 0) + 1;
      }
      if (warn.includes('E1')) mem.weaknesses.E1 = (mem.weaknesses.E1 || 0) + 1;
      if (warn.includes('E2')) mem.weaknesses.E2 = (mem.weaknesses.E2 || 0) + 1;
      if (/\bL\b/.test(warn) || warn.includes('L ')) {
        mem.weaknesses.L = (mem.weaknesses.L || 0) + 1;
      }
    }
  }

  saveUserMemory(userId, mem);
}

export function getWeaknessReport(userId) {
  const mem = getUserMemory(userId);
  const total = Object.values(mem.weaknesses).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  return {
    weaknesses: mem.weaknesses,
    suggestion:
      (mem.weaknesses.E2 || 0) > (mem.weaknesses.P || 0)
        ? 'Your E2 (examples) are the weakest link. Focus on adding concrete physical scenes.'
        : 'Your abstract reasoning (P/E1) needs work.',
  };
}

export function getRelevantFuel(userId, topicId) {
  const mem = getUserMemory(userId);
  return mem.e2Fuel
    .filter((f) => !topicId || f.topic === topicId)
    .slice(-10)
    .reverse();
}
