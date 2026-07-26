import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../server/config.js';

describe('loadConfig', () => {
  it('uses safe local defaults', () => {
    expect(loadConfig({})).toEqual({
      appMode: 'local',
      providerBaseUrl: 'https://api.openai.com/v1',
      upstreamTimeoutMs: 30_000,
      corsOrigins: [],
      trustProxyHops: 0,
      metricsToken: null,
      enableLocalMemory: false,
      enablePrivateQuestionBank: false,
    });
  });

  it('requires explicit CORS origins in public mode', () => {
    expect(() => loadConfig({ APP_MODE: 'public' })).toThrow(/CORS_ORIGINS/);
  });

  it('rejects wildcard CORS in public mode', () => {
    expect(() =>
      loadConfig({ APP_MODE: 'public', CORS_ORIGINS: '*' })
    ).toThrow(/CORS_ORIGINS/);
  });

  it('rejects an insecure provider in public mode', () => {
    expect(() =>
      loadConfig({
        APP_MODE: 'public',
        CORS_ORIGINS: 'https://app.example.com',
        PROVIDER_BASE_URL: 'http://127.0.0.1:8080/v1',
      })
    ).toThrow(/PROVIDER_BASE_URL/);
  });

  it.each([
    'https://user:password@api.example.com/v1',
    'https://api.example.com/v1?tenant=secret',
    'https://api.example.com/v1#fragment',
  ])('rejects provider URLs containing credentials, query, or fragment: %s', (providerBaseUrl) => {
    expect(() => loadConfig({ PROVIDER_BASE_URL: providerBaseUrl })).toThrow(
      /PROVIDER_BASE_URL/
    );
  });

  it('forces persistent capabilities off in public mode', () => {
    const config = loadConfig({
      APP_MODE: 'public',
      CORS_ORIGINS: 'https://app.example.com, https://admin.example.com',
      ENABLE_LOCAL_MEMORY: 'true',
      ENABLE_PRIVATE_QUESTION_BANK: 'true',
      METRICS_TOKEN: ' metrics-secret ',
    });

    expect(config.corsOrigins).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
    expect(config.metricsToken).toBe('metrics-secret');
    expect(config.enableLocalMemory).toBe(false);
    expect(config.enablePrivateQuestionBank).toBe(false);
  });

  it.each([
    ['APP_MODE', 'staging'],
    ['UPSTREAM_TIMEOUT_MS', '0'],
    ['TRUST_PROXY_HOPS', '-1'],
  ])('rejects invalid %s', (name, value) => {
    expect(() => loadConfig({ [name]: value })).toThrow(new RegExp(name));
  });

  it.each([
    ['ENABLE_LOCAL_MEMORY', 'yes'],
    ['ENABLE_PRIVATE_QUESTION_BANK', '1'],
  ])('rejects malformed boolean %s', (name, value) => {
    expect(() => loadConfig({ [name]: value })).toThrow(new RegExp(name));
  });
});
