import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = join(__dirname, '../../.memory');

export function ensureMemoryDir(memoryDir = MEMORY_DIR) {
  if (!existsSync(memoryDir)) mkdirSync(memoryDir, { recursive: true });
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

export function getUserMemory(userId = 'default', memoryDir = MEMORY_DIR) {
  ensureMemoryDir(memoryDir);
  const path = join(memoryDir, `${sanitizeId(userId)}.json`);
  if (!existsSync(path)) return createEmptyMemory(userId);
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return createEmptyMemory(userId);
  }
}

export function saveUserMemory(userId, memory, memoryDir = MEMORY_DIR) {
  ensureMemoryDir(memoryDir);
  writeFileSync(
    join(memoryDir, `${sanitizeId(userId)}.json`),
    JSON.stringify(memory, null, 2)
  );
}

function sanitizeId(id) {
  return String(id || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

export function addE2Fuel(
  userId,
  { topic, entity, sourceQuestion, sourceAnswer },
  memoryDir = MEMORY_DIR
) {
  const mem = getUserMemory(userId, memoryDir);
  mem.e2Fuel.push({
    topic,
    entity,
    sourceQuestion,
    sourceAnswer,
    ts: Date.now(),
  });
  if (mem.e2Fuel.length > 200) mem.e2Fuel = mem.e2Fuel.slice(-200);
  saveUserMemory(userId, mem, memoryDir);
}

export function recordPeelResult(
  userId,
  { topicId, validation, command = 'peel', source = 'agent' },
  memoryDir = MEMORY_DIR
) {
  const mem = getUserMemory(userId, memoryDir);
  if (command === 'matrix') mem.stats.totalMatrices += 1;
  else if (command === 'wizard') mem.stats.totalWizards += 1;
  else if (command === 'peel') mem.stats.totalPeels += 1;

  if (topicId) {
    mem.stats.topTopics[topicId] = (mem.stats.topTopics[topicId] || 0) + 1;
  }

  if (source === 'learner' && validation?.allWarnings) {
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

  saveUserMemory(userId, mem, memoryDir);
}

export function getWeaknessReport(userId, memoryDir = MEMORY_DIR) {
  const mem = getUserMemory(userId, memoryDir);
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

export function getRelevantFuel(userId, topicId, memoryDir = MEMORY_DIR) {
  const mem = getUserMemory(userId, memoryDir);
  return mem.e2Fuel
    .filter((f) => !topicId || f.topic === topicId)
    .slice(-10)
    .reverse();
}

export function getProfile(userId, memoryDir = MEMORY_DIR) {
  const mem = getUserMemory(userId, memoryDir);
  return mem.profile || null;
}

export function saveProfile(userId, profile, memoryDir = MEMORY_DIR) {
  const mem = getUserMemory(userId, memoryDir);
  mem.profile = profile;
  saveUserMemory(userId, mem, memoryDir);
}

export function getAttempt(userId, attemptId, memoryDir = MEMORY_DIR) {
  const mem = getUserMemory(userId, memoryDir);
  return mem.attempts?.[attemptId] || null;
}

export function saveAttempt(userId, attempt, memoryDir = MEMORY_DIR) {
  const mem = getUserMemory(userId, memoryDir);
  if (!mem.attempts) mem.attempts = {};
  const existing = mem.attempts[attempt.id];
  const merged = mergeAttemptRevisions(existing, attempt);
  mem.attempts[attempt.id] = merged;
  saveUserMemory(userId, mem, memoryDir);
}

export function listAttempts(userId, memoryDir = MEMORY_DIR) {
  const mem = getUserMemory(userId, memoryDir);
  return Object.values(mem.attempts || {});
}

export function deleteAllAttempts(userId, memoryDir = MEMORY_DIR) {
  const mem = getUserMemory(userId, memoryDir);
  mem.attempts = {};
  saveUserMemory(userId, mem, memoryDir);
}

export function exportAllAttempts(userId, memoryDir = MEMORY_DIR) {
  const mem = getUserMemory(userId, memoryDir);
  return Object.values(mem.attempts || {}).map((attempt) => ({
    ...attempt,
    revisions: attempt.revisions.map((rev) => ({ ...rev })),
  }));
}

function mergeAttemptRevisions(existing, incoming) {
  if (!existing) return incoming;
  const existingCount = existing.revisions.length;
  const newRevisions = incoming.revisions.slice(existingCount);
  return {
    ...incoming,
    createdAt: existing.createdAt,
    revisions: [...existing.revisions, ...newRevisions],
  };
}
