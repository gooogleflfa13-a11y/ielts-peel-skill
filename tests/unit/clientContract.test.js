import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('public client contract', () => {
  it('does not send or store client-controlled provider URLs or AI score flags', () => {
    const app = read('client/src/App.jsx');
    const apiPanel = read('client/src/components/ApiKeyPanel.jsx');

    expect(app).not.toMatch(/baseUrl|aiScore/);
    expect(apiPanel).not.toMatch(/Base URL|baseUrl/);
  });

  it('omits bank from default capabilities while allowing injected capabilities', () => {
    const app = read('client/src/App.jsx');
    const commandPanel = read('client/src/components/CommandPanel.jsx');

    expect(app).toContain("const DEFAULT_CAPABILITIES = ['peel', 'matrix', 'wizard', 'score']");
    expect(app).toMatch(/function App\(\{ capabilities = DEFAULT_CAPABILITIES \}\)/);
    expect(commandPanel).toMatch(/capabilities\.includes\(c\.id\)/);
  });

  it('resolves complete Tailwind content globs from the config directory', () => {
    const config = read('client/tailwind.config.js');
    const postcss = read('client/postcss.config.js');

    expect(config).toContain("'index.html'");
    expect(config).toContain("'src/**/*.{js,ts,jsx,tsx}'");
    expect(config).toMatch(/import\.meta\.url/);
    expect(postcss).toMatch(/tailwindcss:\s*\{\s*config:/);
    expect(postcss).toContain("new URL('./tailwind.config.js', import.meta.url)");
  });

  it('labels the evolution blueprint as historical wherever README links it', () => {
    const blueprint = read('docs/EVOLUTION_BLUEPRINT.md');
    const readme = read('README.md');

    expect(blueprint).toMatch(/Status:\s*Historical/i);
    expect(blueprint).toContain('PEEL Structure Review');
    expect(readme).toMatch(/historical architecture blueprint/i);
  });
});
