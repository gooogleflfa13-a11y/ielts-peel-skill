import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { runCommand, runCommandStream } from './orchestrator.js';
import { getMetrics } from './utils/metrics.js';
import { log } from './utils/logger.js';
import { API_VERSION } from './utils/constants.js';

const config = loadConfig(process.env);
const port = Number(process.env.PORT || 3001);
const app = createApp({ config, runCommand, runCommandStream, getMetrics });

app.listen(port, () => {
  log('INFO', 'server.start', { port, version: API_VERSION, mode: config.appMode });
  console.log(`IELTS PEEL Hacker server -> http://localhost:${port}`);
});
