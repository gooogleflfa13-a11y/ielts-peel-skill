import { useState } from 'react';

export const PROFILE_STORAGE_KEY = 'peel-hacker-profile';

export function loadProfile() {
  try {
    const raw = sessionStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  try {
    sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* sessionStorage unavailable or quota exceeded - ignore */
  }
}

const BAND_OPTIONS = [5, 6, 7, 8, 9];

const DEFAULT_FORM = {
  testType: 'academic',
  skill: 'writing',
  targetBand: 7,
  currentLevel: 6,
  examDate: '',
  language: 'en',
};

export default function Onboarding({ onComplete, initialProfile }) {
  const [form, setForm] = useState(() => ({ ...DEFAULT_FORM, ...(initialProfile || {}) }));
  const [error, setError] = useState('');

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const targetBand = Number(form.targetBand);
    const currentLevel = Number(form.currentLevel);
    if (!Number.isInteger(targetBand) || targetBand < 5 || targetBand > 9) {
      setError('Target band must be an integer between 5 and 9.');
      return;
    }
    if (!Number.isInteger(currentLevel) || currentLevel < 5 || currentLevel > 9) {
      setError('Current level must be an integer between 5 and 9.');
      return;
    }
    if (!form.testType || !form.skill || !form.language) {
      setError('Please select a test type, skill surface, and interface language.');
      return;
    }
    setError('');
    const profile = {
      testType: form.testType,
      skill: form.skill,
      targetBand,
      currentLevel,
      examDate: form.examDate || null,
      language: form.language,
      createdAt: new Date().toISOString(),
    };
    saveProfile(profile);
    onComplete?.(profile);
  };

  return (
    <section
      className="panel mx-auto max-w-xl p-5"
      aria-labelledby="onboarding-title"
    >
      <h2 id="onboarding-title" className="label mb-1">
        Welcome · Learner Profile
      </h2>
      <p className="mb-4 text-xs text-slate-400">
        First-time setup. Your profile stays in this session only.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="onboarding-testType" className="label mb-1.5 block">
            Test type
          </label>
          <select
            id="onboarding-testType"
            className="input"
            value={form.testType}
            onChange={(e) => update('testType', e.target.value)}
          >
            <option value="academic">Academic</option>
            <option value="general">General Training</option>
          </select>
        </div>

        <div>
          <label htmlFor="onboarding-skill" className="label mb-1.5 block">
            Skill surface
          </label>
          <select
            id="onboarding-skill"
            className="input"
            value={form.skill}
            onChange={(e) => update('skill', e.target.value)}
          >
            <option value="writing">Writing Task 2</option>
            <option value="speaking">Speaking Part 3</option>
          </select>
        </div>

        <div>
          <label htmlFor="onboarding-targetBand" className="label mb-1.5 block">
            Target band (5-9)
          </label>
          <select
            id="onboarding-targetBand"
            className="input"
            value={form.targetBand}
            onChange={(e) => update('targetBand', Number(e.target.value))}
          >
            {BAND_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="onboarding-currentLevel" className="label mb-1.5 block">
            Current level (5-9)
          </label>
          <select
            id="onboarding-currentLevel"
            className="input"
            value={form.currentLevel}
            onChange={(e) => update('currentLevel', Number(e.target.value))}
          >
            {BAND_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="onboarding-examDate" className="label mb-1.5 block">
            Exam date
          </label>
          <input
            id="onboarding-examDate"
            type="date"
            className="input"
            value={form.examDate}
            onChange={(e) => update('examDate', e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="onboarding-language" className="label mb-1.5 block">
            Interface language
          </label>
          <select
            id="onboarding-language"
            className="input"
            value={form.language}
            onChange={(e) => update('language', e.target.value)}
          >
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary w-full">
          Save profile &amp; continue
        </button>
      </form>
    </section>
  );
}
