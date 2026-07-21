const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'] ?? 1;

export function log(level, event, data = {}) {
  if ((LOG_LEVELS[level] ?? 1) < CURRENT_LEVEL) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };
  // Never log apiKey
  if (entry.apiKey) delete entry.apiKey;
  console.log(JSON.stringify(entry));
}
