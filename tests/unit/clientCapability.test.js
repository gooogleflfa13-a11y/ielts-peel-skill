import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

const require = createRequire(new URL('../../client/package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
globalThis.React = React;

describe('client derives visible commands from health response', () => {
  it('fetches /api/health on mount', () => {
    const app = read('client/src/App.jsx');
    expect(app).toMatch(/fetch\s*\(\s*['"`]\/api\/health['"`]\s*\)/);
  });

  it('uses the commands array from the health response to set capabilities', () => {
    const app = read('client/src/App.jsx');
    expect(app).toMatch(/\.commands/);
    expect(app).toMatch(/Array\.isArray.*commands|data\.commands/);
  });

  it('falls back to default capabilities when health fetch fails', () => {
    const app = read('client/src/App.jsx');
    expect(app).toContain("DEFAULT_CAPABILITIES = ['peel', 'matrix', 'wizard', 'score']");
    expect(app).toMatch(/\.catch\s*\(/);
  });

  it('does not pass the static prop directly to CommandPanel - uses state', () => {
    const app = read('client/src/App.jsx');
    expect(app).not.toMatch(/capabilities=\{capabilities\}/);
    expect(app).toMatch(/capabilities=\{active/);
  });
});
