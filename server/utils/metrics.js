const metrics = {
  peelTotal: 0,
  peelFailed: 0,
  matrixTotal: 0,
  wizardTotal: 0,
  scoreTotal: 0,
  tokenUsed: 0,
  latencyMs: [],
  topicDistribution: {},
  validationPassRate: '0.0',
};

export function recordPeel({ topicId, tokens = 0, latency = 0, passed = true, command = 'peel' }) {
  if (command === 'matrix') metrics.matrixTotal += 1;
  else if (command === 'wizard') metrics.wizardTotal += 1;
  else if (command === 'score') metrics.scoreTotal += 1;
  else metrics.peelTotal += 1;

  metrics.tokenUsed += tokens || 0;
  if (topicId) {
    metrics.topicDistribution[topicId] = (metrics.topicDistribution[topicId] || 0) + 1;
  }
  if (!passed) metrics.peelFailed += 1;
  metrics.latencyMs.push(latency);
  if (metrics.latencyMs.length > 1000) metrics.latencyMs.shift();

  const total =
    metrics.peelTotal + metrics.matrixTotal + metrics.wizardTotal || 1;
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
