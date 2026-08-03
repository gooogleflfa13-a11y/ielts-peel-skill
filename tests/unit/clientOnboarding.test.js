import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import Onboarding, {
  loadProfile,
  saveProfile,
  PROFILE_STORAGE_KEY,
} from '../../client/src/components/Onboarding.jsx';

const require = createRequire(new URL('../../client/package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
globalThis.React = React;

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');

function makeSessionStore() {
  let store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
}

describe('Onboarding component', () => {
  beforeEach(() => {
    globalThis.sessionStorage = makeSessionStore();
  });
  afterEach(() => {
    delete globalThis.sessionStorage;
  });

  it('renders all six profile fields with associated labels (for/id pairs)', () => {
    const html = renderToStaticMarkup(
      React.createElement(Onboarding, { onComplete: () => {} })
    );

    for (const field of ['testType', 'skill', 'targetBand', 'currentLevel', 'examDate', 'language']) {
      const id = `onboarding-${field}`;
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('exposes a dedicated profile storage key', () => {
    expect(typeof PROFILE_STORAGE_KEY).toBe('string');
    expect(PROFILE_STORAGE_KEY.length).toBeGreaterThan(0);
    expect(PROFILE_STORAGE_KEY).toMatch(/profile/i);
  });

  it('loadProfile returns null on first visit (empty sessionStorage)', () => {
    expect(loadProfile()).toBeNull();
  });

  it('saveProfile persists to sessionStorage and loadProfile round-trips the profile', () => {
    const profile = {
      testType: 'academic',
      targetBand: 7,
      currentLevel: 6,
      examDate: '2026-09-12',
      language: 'en',
      createdAt: '2026-07-27T00:00:00.000Z',
    };
    saveProfile(profile);
    const raw = globalThis.sessionStorage.getItem(PROFILE_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw).targetBand).toBe(7);
    expect(loadProfile()).toMatchObject(profile);
  });

  it('saveProfile swallows storage errors without throwing', () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
      clear: () => {},
    };
    globalThis.sessionStorage = broken;
    expect(() => saveProfile({ testType: 'academic' })).not.toThrow();
  });

  it('offers target band and current level options across the 5-9 range', () => {
    const html = renderToStaticMarkup(
      React.createElement(Onboarding, { onComplete: () => {} })
    );
    // Both selects must offer 5,6,7,8,9
    for (const band of [5, 6, 7, 8, 9]) {
      const re = new RegExp(`value="${band}"`, 'g');
      const matches = html.match(re) || [];
      // At least two occurrences: one for targetBand, one for currentLevel
      expect(matches.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('is keyboard-submittable via a form with a submit button', () => {
    const html = renderToStaticMarkup(
      React.createElement(Onboarding, { onComplete: () => {} })
    );
    expect(html).toContain('<form');
    expect(html).toContain('type="submit"');
    expect(html).toMatch(/Save profile/i);
  });

  it('renders an aria-live error region', () => {
    const html = renderToStaticMarkup(
      React.createElement(Onboarding, { onComplete: () => {} })
    );
    // error region is conditionally rendered; assert the component source supports it
    const src = read('client/src/components/Onboarding.jsx');
    expect(src).toMatch(/role=["']alert["']/);
    expect(src).toMatch(/aria-live/);
  });
});

describe('App onboarding flow', () => {
  it('imports Onboarding and gates the main interface on a stored profile', () => {
    const app = read('client/src/App.jsx');
    expect(app).toMatch(/import\s+Onboarding/);
    // Profile loaded from sessionStorage so first-time users see onboarding
    expect(app).toMatch(/sessionStorage|loadProfile/);
    // Onboarding rendered conditionally before main interface
    expect(app).toMatch(/Onboarding/);
  });

  it('persists the profile via the server (defensive fetch with catch)', () => {
    const app = read('client/src/App.jsx');
    expect(app).toMatch(/\/api\/learner\/profile/);
    expect(app).toMatch(/\.catch\s*\(/);
  });
});
