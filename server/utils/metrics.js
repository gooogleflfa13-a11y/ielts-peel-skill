/**
 * In-process metrics (single Node process only).
 * PM2 cluster / multi-instance will NOT aggregate these — use external APM if needed.
 */
const metrics = {
  peelTotal: 0,
  peelFailed: 0,
  matrixTotal: 0,
  wizardTotal: 0,
  scoreTotal: 0,
  bankTotal: 0,
  tokenUsed: 0,
  latencyMs: [],
  topicDistribution: {},
  validationPassRate: '0.0',
  mode: 'single-process',
};

export function recordMetric({
  topicId,
  tokens = 0,
  latency = 0,
  passed = true,
  command = 'peel',
} = {}) {
  // backward-compatible alias name used elsewhere
  return recordPeel({ topicId, tokens, latency, passed, command });
}

/** @deprecated prefer recordMetric — kept for existing call sites */
export function recordPeel({ topicId, tokens = 0, latency = 0, passed = true, command = 'peel' }) {
  const cmd = command || 'peel';
  if (cmd === 'matrix') metrics.matrixTotal += 1;
  else if (cmd === 'wizard') metrics.wizardTotal += 1;
  else if (cmd === 'score') metrics.scoreTotal += 1;
  else if (cmd === 'bank') metrics.bankTotal += 1;
  else metrics.peelTotal += 1;

  metrics.tokenUsed += tokens || 0;
  if (topicId) {
    metrics.topicDistribution[topicId] = (metrics.topicDistribution[topicId] || 0) + 1;
  }
  if (!passed && cmd === 'peel') metrics.peelFailed += 1;

  metrics.latencyMs.push(latency);
  if (metrics.latencyMs.length > 1000) metrics.latencyMs.shift();

  const total =
    metrics.peelTotal +
      metrics.matrixTotal +
      metrics.wizardTotal +
      metrics.scoreTotal +
      metrics.bankTotal || 1;
  metrics.validationPassRate = (
    ((total - metrics.peelFailed) / total) *
    100
  ).toFixed(1);
}

export function getMetrics() {
  return {
    ...metrics,
    avgLatency:
      metrics.latencyMs.length > 0
        ? (
            metrics.latencyMs.reduce((a, b) => a + b, 0) / metrics.latencyMs.length
          ).toFixed(1)
        : 0,
  };
}
