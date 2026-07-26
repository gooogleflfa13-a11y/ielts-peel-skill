import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import ApiKeyPanel from '../../client/src/components/ApiKeyPanel.jsx';
import CommandPanel from '../../client/src/components/CommandPanel.jsx';
import ResultPanel from '../../client/src/components/ResultPanel.jsx';

const require = createRequire(new URL('../../client/package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
globalThis.React = React;

const commandProps = {
  command: 'score',
  setCommand: () => {},
  input: '',
  setInput: () => {},
  loading: false,
  onGenerate: () => {},
  onClearWizard: () => {},
  wizardTurns: 0,
  needsApiKey: false,
};

describe('client runtime surface', () => {
  it('omits bank by default and renders it only when injected', () => {
    const publicHtml = renderToStaticMarkup(React.createElement(CommandPanel, commandProps));
    const localHtml = renderToStaticMarkup(React.createElement(CommandPanel, {
      ...commandProps,
      capabilities: ['peel', 'matrix', 'wizard', 'score', 'bank'],
    }));

    expect(publicHtml).toContain('/score');
    expect(publicHtml).not.toContain('/bank');
    expect(localHtml).toContain('/bank');
  });

  it('renders structural checks, revision action, and disclaimer without pseudo-scores', () => {
    const html = renderToStaticMarkup(React.createElement(ResultPanel, {
      result: {
        command: 'score',
        content: '[P] Point\n[E1] Mechanism\n[E2] Example\n[L] Link',
        parsed: { peels: [] },
        feedback: {
          status: 'issues_found',
          checks: {
            labels: 'pass',
            layerBoundaries: 'fail',
            e2Concreteness: 'pass',
            linkClosure: 'pass',
            bannedGlue: 'pass',
          },
          issues: [{
            layer: 'E1',
            evidence: 'E1 contains concrete entities.',
            action: 'Move the scene to E2.',
          }],
        },
        disclaimer: 'PEEL structure feedback only. Not an official IELTS assessment or band estimate.',
      },
      loading: false,
      error: '',
      revalidating: false,
    }));

    expect(html).toContain('Layer boundaries');
    expect(html).toContain('Revise: Move the scene to E2.');
    expect(html).toContain('Not an official IELTS assessment or band estimate.');
    expect(html).not.toMatch(/structure:\s*\d|overall\s+\d|P_score/i);
  });

  it('renders server-owned provider copy without a base URL control', () => {
    const html = renderToStaticMarkup(React.createElement(ApiKeyPanel, {
      settings: { apiKey: '', model: 'gpt-4o-mini' },
      onChange: () => {},
    }));

    expect(html).toContain('Provider endpoint is configured by the server.');
    expect(html).not.toContain('Base URL');
  });
});
