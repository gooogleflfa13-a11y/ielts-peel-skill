const DEFAULT_PROVIDER_BASE_URL = 'https://api.openai.com/v1';

function parseInteger(env, name, defaultValue, { min }) {
  if (env[name] == null || env[name] === '') return defaultValue;

  const value = Number(env[name]);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer greater than or equal to ${min}`);
  }
  return value;
}

function parseBoolean(env, name) {
  if (env[name] == null || env[name] === '') return false;

  const value = String(env[name]).trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function parseProviderBaseUrl(value, appMode) {
  let url;
  try {
    url = new URL(value || DEFAULT_PROVIDER_BASE_URL);
  } catch {
    throw new Error('PROVIDER_BASE_URL must be a valid URL');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error('PROVIDER_BASE_URL must not contain credentials, query, or fragment');
  }
  if (appMode === 'public' && url.protocol !== 'https:') {
    throw new Error('PROVIDER_BASE_URL must use HTTPS in public mode');
  }

  return url.toString().replace(/\/$/, '');
}

export function loadConfig(env = process.env) {
  const appMode = env.APP_MODE || 'local';
  if (appMode !== 'local' && appMode !== 'public') {
    throw new Error('APP_MODE must be local or public');
  }

  const corsOrigins = String(env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (
    appMode === 'public' &&
    (corsOrigins.length === 0 || corsOrigins.includes('*'))
  ) {
    throw new Error('CORS_ORIGINS must be an explicit allowlist in public mode');
  }

  const localMemoryRequested = parseBoolean(env, 'ENABLE_LOCAL_MEMORY');
  const privateQuestionBankRequested = parseBoolean(
    env,
    'ENABLE_PRIVATE_QUESTION_BANK'
  );

  return {
    appMode,
    providerBaseUrl: parseProviderBaseUrl(env.PROVIDER_BASE_URL, appMode),
    upstreamTimeoutMs: parseInteger(env, 'UPSTREAM_TIMEOUT_MS', 30_000, { min: 1 }),
    corsOrigins,
    trustProxyHops: parseInteger(env, 'TRUST_PROXY_HOPS', 0, { min: 0 }),
    metricsToken: String(env.METRICS_TOKEN || '').trim() || null,
    enableLocalMemory: appMode === 'local' && localMemoryRequested,
    enablePrivateQuestionBank:
      appMode === 'local' && privateQuestionBankRequested,
  };
}
