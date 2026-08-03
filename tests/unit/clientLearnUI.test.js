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
  question: '',
  setQuestion: () => {},
  studentText: '',
  setStudentText: () => {},
  attemptId: '',
  setAttemptId: () => {},
  loading: false,
  onSubmit: () => {},
  result: null,
  error: '',
  profile: { testType: 'academic', language: 'en', skill: 'writing' },
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
    expect(html).toContain('for="learn-question"');
    expect(html).toContain('id="learn-question"');
    expect(html).toContain('for="learn-studentText"');
    expect(html).toContain('id="learn-studentText"');
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
              criteria: {
                TR: { status: 'watch', notes: 'Sharpen the thesis.' },
                CC: { status: 'pass', notes: '' },
                LR: { status: 'pass', notes: '' },
                GRA: { status: 'watch', notes: 'Check subject-verb agreement.' },
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
              criteria: {
                TR: { status: 'pass', notes: 'ok' },
                CC: { status: 'pass', notes: 'ok' },
                LR: { status: 'pass', notes: 'ok' },
                GRA: { status: 'pass', notes: 'ok' },
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
    criteria: {
      TR: { status: 'watch', notes: 'Position is implicit; state it in [P].' },
      CC: { status: 'pass', notes: 'PEEL order maintained.' },
      LR: { status: 'watch', notes: 'Repeat of "good" - vary lexis.' },
      GRA: { status: 'fail', notes: 'Run-on sentence in [E1].' },
    },
    disclaimer:
      'Formative feedback based on official IELTS criteria. Not an official assessment or band prediction.',
  };

  const speakingFeedback = {
    criteria: {
      FC: { status: 'pass', notes: 'Natural pacing.' },
      LR: { status: 'watch', notes: 'Limited collocations.' },
      GRA: { status: 'pass', notes: 'Accurate tenses.' },
      PR: { status: 'not_assessed', notes: 'Pronunciation needs audio.' },
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
    expect(html).toContain('data-criterion-status="not_assessed"');
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

  it('sends question, studentText, attemptId, and skill without a mock fallback', () => {
    const app = read('client/src/App.jsx');
    expect(app).toMatch(/studentText\s*:/);
    expect(app).toMatch(/attemptId\s*:/);
    expect(app).toMatch(/skill\s*:/);
    expect(app).not.toMatch(/buildMockLearnResult/);
    expect(app).not.toMatch(/Showing mock data/);
  });
});

describe('accessibility: reduced motion', () => {
  it('declares a prefers-reduced-motion media query in the client stylesheet', () => {
    const css = read('client/src/index.css');
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion/);
  });
});
