import { useCallback, useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import ApiKeyPanel from './components/ApiKeyPanel.jsx';
import CommandPanel from './components/CommandPanel.jsx';
import ResultPanel from './components/ResultPanel.jsx';
import Onboarding, { loadProfile, saveProfile } from './components/Onboarding.jsx';
import LearnPanel from './components/LearnPanel.jsx';

const STORAGE_KEY = 'peel-hacker-settings';

const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'gpt-4o-mini',
};
const DEFAULT_CAPABILITIES = ['peel', 'matrix', 'wizard', 'score'];

function loadSettings() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model : DEFAULT_SETTINGS.model,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function peelToText(peel) {
  return `[P] ${peel.P}\n[E1] ${peel.E1}\n[E2] ${peel.E2}\n[L] ${peel.L}`;
}

const CRITERION_DISCLAIMER =
  'Formative feedback based on official IELTS criteria. Not an official assessment or band prediction.';

// Mock learn result used when the backend learner module is absent (UI lane
// runs ahead of the core lane). Produces a criterion-feedback shape so the
// LearnPanel + CriterionFeedback components can be exercised end-to-end.
function buildMockLearnResult(mode, input, profile) {
  const skill = profile?.testType === 'speaking' ? 'speaking' : 'writing';
  const writing = {
    taskResponse: { status: 'watch', notes: 'State your position explicitly in [P].' },
    coherence: { status: 'pass', notes: 'PEEL order maintained.' },
    lexical: { status: 'watch', notes: 'Vary word choice beyond common adjectives.' },
    grammar: { status: 'pass', notes: 'Sentence boundaries are clean.' },
  };
  const speaking = {
    fluency: { status: 'pass', notes: 'Natural pacing indicators present.' },
    lexical: { status: 'watch', notes: 'Add collocations to lift range.' },
    grammar: { status: 'pass', notes: 'Tense use is accurate.' },
    pronunciation: { status: 'watch', notes: 'Mark word stress on multi-syllable lexis.' },
  };
  const content =
    mode === 'model'
      ? '[P] Practice shapes performance under exam conditions.\n[E1] Repeated retrieval strengthens neural pathways that transfer skill to novel prompts.\n[E2] In 2024, Cambridge reported candidates who wrote three timed essays scored 0.5 higher on average.\n[L] Hence, deliberate practice is the highest-leverage variable in band improvement.'
      : mode === 'hint'
        ? 'Scaffolding: What is your position? Which mechanism links cause to effect? Which concrete example grounds the mechanism? How does the link return to the question?'
        : input || '';
  return {
    command: 'learn',
    mode,
    skill,
    content,
    criterionFeedback: { writing, speaking, disclaimer: CRITERION_DISCLAIMER },
    disclaimer: CRITERION_DISCLAIMER,
    mock: true,
  };
}

export default function App({ capabilities = DEFAULT_CAPABILITIES }) {
  const [settings, setSettings] = useState(loadSettings);
  const [activeCapabilities, setActiveCapabilities] = useState(capabilities);
  const [profile, setProfile] = useState(() => loadProfile());
  const [view, setView] = useState('main'); // 'main' | 'learn'
  const [learnMode, setLearnMode] = useState('practice');
  const [learnInput, setLearnInput] = useState('');
  const [learnLoading, setLearnLoading] = useState(false);
  const [learnResult, setLearnResult] = useState(null);
  const [learnError, setLearnError] = useState('');
  const [command, setCommand] = useState('peel');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiKey: settings.apiKey,
        model: settings.model,
      })
    );
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.commands) && data.commands.length > 0) {
          setActiveCapabilities(data.commands);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const handleGenerate = async () => {
    setError('');
    // score free; bank free except peel; peel/matrix/wizard need key
    const bankPeel =
      command === 'bank' &&
      /\b(peel|answer|答|作答)\b/i.test(input) &&
      !/\b(random|search|links|stats|抽题|随机)\b/i.test(input);
    const requireKey =
      command === 'peel' ||
      command === 'matrix' ||
      command === 'wizard' ||
      bankPeel;
    if (requireKey && !settings.apiKey.trim()) {
      setError('请先输入 API Key。');
      return;
    }
    if (!input.trim() && command !== 'wizard' && command !== 'bank') {
      setError('请输入题目、现象或 PEEL 文本。');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: settings.apiKey.trim() || undefined,
          model: settings.model.trim() || DEFAULT_SETTINGS.model,
          command,
          input: input.trim(),
          history: command === 'wizard' ? history : [],
          userId: 'default',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setResult(data);

      if (command === 'wizard') {
        const userMsg = input.trim().startsWith('/wizard')
          ? input.trim()
          : `/wizard ${input.trim()}`.trim();
        // Cap turns + truncate long assistant bodies to avoid 40k+ token history blowup
        const MAX_TURNS = 8;
        const MAX_ASSISTANT_CHARS = 1200;
        const assistantBody = String(data.content || '').slice(0, MAX_ASSISTANT_CHARS);
        setHistory((h) => {
          const next = [
            ...h,
            { role: 'user', content: userMsg || '/wizard' },
            { role: 'assistant', content: assistantBody },
          ];
          // keep last N message pairs (2 messages each)
          return next.slice(-(MAX_TURNS * 2));
        });
      } else if (command !== 'score' && command !== 'bank') {
        setHistory([]);
      }
    } catch (e) {
      setError(e.message || '请求失败');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRevalidate = async (lines) => {
    setRevalidating(true);
    setError('');
    try {
      const text = peelToText(lines);
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult((prev) => ({
        ...data,
        command: prev?.command || 'score',
        model: prev?.model,
      }));
      setInput(text);
    } catch (e) {
      setError(e.message || 'Re-validate failed');
    } finally {
      setRevalidating(false);
    }
  };

  const handleClearWizard = () => {
    setHistory([]);
    setResult(null);
    setError('');
  };

  const handleOnboardingComplete = useCallback((nextProfile) => {
    setProfile(nextProfile);
    // Persist profile server-side when a learner store is available. Defensive:
    // public mode (null store) or missing route resolves to empty/no-op.
    fetch('/api/learner/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'default', profile: nextProfile }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => {});
  }, []);

  const handleLearnSubmit = async () => {
    setLearnError('');
    if (learnMode !== 'revise' && !learnInput.trim()) {
      setLearnError('Write your attempt first.');
      return;
    }
    setLearnLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: settings.apiKey.trim() || undefined,
          model: settings.model.trim() || DEFAULT_SETTINGS.model,
          command: 'learn',
          input: learnInput.trim(),
          mode: learnMode,
          userId: 'default',
          profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setLearnResult(data);
    } catch (e) {
      // Backend learner module is not wired yet in this lane. Surface a mock
      // criterion-feedback result so the UI lane is testable end-to-end.
      setLearnResult(buildMockLearnResult(learnMode, learnInput, profile));
      setLearnError(e?.message ? `Backend unavailable: ${e.message}. Showing mock data.` : '');
    } finally {
      setLearnLoading(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Header />

      {/* First-visit onboarding: capture learner profile before the main UI. */}
      {!profile ? (
        <div className="mt-6">
          <Onboarding onComplete={handleOnboardingComplete} />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label="Interface view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'main'}
              onClick={() => setView('main')}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                view === 'main'
                  ? 'border-acid-500/50 bg-acid-500/10 text-acid-400'
                  : 'border-white/10 text-slate-400 hover:border-white/20'
              }`}
            >
              Commands
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'learn'}
              onClick={() => setView('learn')}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                view === 'learn'
                  ? 'border-acid-500/50 bg-acid-500/10 text-acid-400'
                  : 'border-white/10 text-slate-400 hover:border-white/20'
              }`}
            >
              Learn
            </button>
            <span className="ml-auto text-[11px] text-slate-500">
              {profile.testType} · band {profile.targetBand}
            </span>
          </div>

          {view === 'learn' ? (
            <div aria-live="polite">
              <LearnPanel
                mode={learnMode}
                setMode={setLearnMode}
                input={learnInput}
                setInput={setLearnInput}
                loading={learnLoading}
                onSubmit={handleLearnSubmit}
                result={learnResult}
                error={learnError}
                profile={profile}
              />
            </div>
          ) : (
            <>
              <ApiKeyPanel settings={settings} onChange={updateSettings} />

              <div className="grid gap-4 lg:grid-cols-2">
                <CommandPanel
                  command={command}
                  setCommand={setCommand}
                  input={input}
                  setInput={setInput}
                  loading={loading}
                  onGenerate={handleGenerate}
                  onClearWizard={handleClearWizard}
                  wizardTurns={history.filter((m) => m.role === 'user').length}
                  needsApiKey={command !== 'score'}
                  capabilities={activeCapabilities}
                />
                <ResultPanel
                  result={result}
                  loading={loading}
                  error={error}
                  onRevalidate={handleRevalidate}
                  revalidating={revalidating}
                />
              </div>
            </>
          )}
        </div>
      )}

      <footer className="mt-10 border-t border-white/5 pt-6 text-center text-xs text-slate-500">
        IELTS PEEL Hacker v2 · orchestrator · quality gate · [P]->[E1]->[E2]->[L]
      </footer>
    </div>
  );
}
