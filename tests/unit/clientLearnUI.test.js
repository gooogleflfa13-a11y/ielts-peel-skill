import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import LearnPanel from '../../client/src/components/LearnPanel.jsx';
import CriterionFeedback from '../../client/src/components/CriterionFeedback.jsx';

const require = createRequire(new URL('../../client/package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
globalThis.React = React;

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

const LEARN_MODES = ['practice', 'hint', 'model', 'compare', 'revise'];

const baseLearnProps = (overrides = {}) => ({
  mode: 'practice',
  setMode: () => {},
  input: '',
  setInput: () => {},
  loading: false,
  onSubmit: () => {},
  result: null,
  error: '',
  profile: { testType: 'academic', language: 'en' },
  ...overrides,
});

describe('LearnPanel component', () => {
  it('renders exactly the five learning mode buttons with data-mode attributes', () => {
    const html = renderToStaticMarkup(React.createElement(LearnPanel, baseLearnProps()));
    for (const m of LEARN_MODES) {
      expect(html).toContain(`data-mode="${m}"`);
    }
    // each mode is a button with aria-pressed
    const pressed = html.match(/aria-pressed="true"/g) || [];
    expect(pressed.length).toBe(1);
  });

  it('renders an associated input area (label + textarea) for the student attempt', () => {
    const html = renderToStaticMarkup(React.createElement(LearnPanel, baseLearnProps()));
    expect(html).toContain('for="learn-input"');
    expect(html).toContain('id="learn-input"');
    expect(html).toContain('<textarea');
  });

  it('uses an aria-live polite region with aria-busy for loading/result states', () => {
    const html = renderToStaticMarkup(React.createElement(LearnPanel, baseLearnProps()));
    expect(html).toMatch(/aria-live="polite"/);
    expect(html).toContain('aria-busy="false"');
  });

  it('renders an alert role for errors and a status role for results', () => {
    const errHtml = renderToStaticMarkup(
      React.createElement(LearnPanel, baseLearnProps({ error: 'Something broke' }))
    );
    expect(errHtml).toMatch(/role="alert"/);
    expect(errHtml).toContain('Something broke');

    const resHtml = renderToStaticMarkup(
      React.createElement(
        LearnPanel,
        baseLearnProps({
          result: {
            content: '[P] Point\n[E1] Evidence\n[E2] Example\n[L] Link',
            criterionFeedback: {
              writing: {
                taskResponse: { status: 'watch', notes: 'Sharpen the thesis.' },
                coherence: { status: 'pass', notes: '' },
                lexical: { status: 'pass', notes: '' },
                grammar: { status: 'watch', notes: 'Check subject-verb agreement.' },
              },
              disclaimer:
                'Formative feedback based on official IELTS criteria. Not an official assessment or band prediction.',
            },
          },
        })
      )
    );
    expect(resHtml).toMatch(/role="status"/);
  });

  it('supports Enter to submit from the textarea (onKeyDown handler)', () => {
    const src = read('client/src/components/LearnPanel.jsx');
    expect(src).toMatch(/onKeyDown/);
    expect(src).toMatch(/['"`]Enter['"`]/);
    expect(src).toMatch(/shiftKey/);
  });

  it('renders the criterion feedback child when a result carries criterionFeedback', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        LearnPanel,
        baseLearnProps({
          result: {
            content: 'model text',
            criterionFeedback: {
              writing: {
                taskResponse: { status: 'pass', notes: 'ok' },
                coherence: { status: 'pass', notes: 'ok' },
                lexical: { status: 'pass', notes: 'ok' },
                grammar: { status: 'pass', notes: 'ok' },
              },
              disclaimer: 'Formative feedback based on official IELTS criteria.',
            },
          },
        })
      )
    );
    expect(html).toContain('Criterion Feedback');
  });
});

describe('CriterionFeedback component', () => {
  const writingFeedback = {
    writing: {
      taskResponse: { status: 'watch', notes: 'Position is implicit; state it in [P].' },
      coherence: { status: 'pass', notes: 'PEEL order maintained.' },
      lexical: { status: 'watch', notes: 'Repeat of "good" - vary lexis.' },
      grammar: { status: 'fail', notes: 'Run-on sentence in [E1].' },
    },
    disclaimer:
      'Formative feedback based on official IELTS criteria. Not an official assessment or band prediction.',
  };

  const speakingFeedback = {
    speaking: {
      fluency: { status: 'pass', notes: 'Natural pacing.' },
      lexical: { status: 'watch', notes: 'Limited collocations.' },
      grammar: { status: 'pass', notes: 'Accurate tenses.' },
      pronunciation: { status: 'watch', notes: 'Word stress on "develOP".' },
    },
    disclaimer:
      'Formative feedback based on official IELTS criteria. Not an official assessment or band prediction.',
  };

  it('renders the four Writing criteria TR/CC/LR/GRA with status badges and notes', () => {
    const html = renderToStaticMarkup(
      React.createElement(CriterionFeedback, { feedback: writingFeedback, skill: 'writing' })
    );
    expect(html).toContain('TR');
    expect(html).toContain('CC');
    expect(html).toContain('LR');
    expect(html).toContain('GRA');
    expect(html).toContain('Task Response');
    expect(html).toContain('Coherence');
    expect(html).toContain('Lexical Resource');
    expect(html).toContain('Grammatical Range');
    // status badges
    expect(html).toContain('data-criterion-status="watch"');
    expect(html).toContain('data-criterion-status="pass"');
    expect(html).toContain('data-criterion-status="fail"');
    // notes
    expect(html).toContain('Position is implicit; state it in [P].');
    expect(html).toContain('Run-on sentence in [E1].');
  });

  it('renders the four Speaking criteria FC/LR/GRA/PR when skill is speaking', () => {
    const html = renderToStaticMarkup(
      React.createElement(CriterionFeedback, { feedback: speakingFeedback, skill: 'speaking' })
    );
    expect(html).toContain('FC');
    expect(html).toContain('LR');
    expect(html).toContain('GRA');
    expect(html).toContain('PR');
    expect(html).toContain('Fluency');
    expect(html).toContain('Pronunciation');
    expect(html).not.toContain('Task Response');
  });

  it('always includes the disclaimer and never emits a band score', () => {
    const html = renderToStaticMarkup(
      React.createElement(CriterionFeedback, { feedback: writingFeedback, skill: 'writing' })
    );
    expect(html).toContain('Not an official assessment or band prediction');
    expect(html).toContain('data-disclaimer');
    // no numeric band-like patterns
    expect(html).not.toMatch(/band[:\s]*\d/i);
    expect(html).not.toMatch(/score[:\s]*\d/i);
  });

  it('renders nothing when feedback is absent', () => {
    const html = renderToStaticMarkup(
      React.createElement(CriterionFeedback, { feedback: null, skill: 'writing' })
    );
    expect(html).toBe('');
  });
});

describe('App learn-mode integration', () => {
  it('imports the learn components and exposes a learn view alongside existing commands', () => {
    const app = read('client/src/App.jsx');
    expect(app).toMatch(/import\s+LearnPanel/);
    // CriterionFeedback is composed by LearnPanel
    const learnPanel = read('client/src/components/LearnPanel.jsx');
    expect(learnPanel).toMatch(/import\s+CriterionFeedback/);
    // default capabilities remain unchanged (regression guard)
    expect(app).toContain("DEFAULT_CAPABILITIES = ['peel', 'matrix', 'wizard', 'score']");
  });

  it('keeps the health-check fetch and active-capabilities wiring intact', () => {
    const app = read('client/src/App.jsx');
    expect(app).toMatch(/fetch\s*\(\s*['"`]\/api\/health['"`]\s*\)/);
    expect(app).toMatch(/capabilities=\{active/);
    expect(app).not.toMatch(/capabilities=\{capabilities\}/);
  });
});

describe('accessibility: reduced motion', () => {
  it('declares a prefers-reduced-motion media query in the client stylesheet', () => {
    const css = read('client/src/index.css');
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion/);
  });
});
