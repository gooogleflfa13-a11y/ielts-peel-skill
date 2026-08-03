import CriterionFeedback from './CriterionFeedback.jsx';

const MODES = [
  { id: 'practice', label: 'Practice', hint: 'Write your own attempt first, then receive structural + criterion feedback.' },
  { id: 'hint', label: 'Hint', hint: 'Get scaffolding questions - not the answer. Then write your attempt.' },
  { id: 'model', label: 'Model', hint: 'See a model PEEL answer tagged as a model response.' },
  { id: 'compare', label: 'Compare', hint: 'Compare your attempt with a model side-by-side with diff notes.' },
  { id: 'revise', label: 'Revise', hint: 'Load a prior attempt, edit it, and re-score with fresh feedback.' },
];

export default function LearnPanel({
  mode,
  setMode,
  question,
  setQuestion,
  studentText,
  setStudentText,
  attemptId,
  loading,
  onSubmit,
  result,
  error,
  profile,
}) {
  const activeMode = MODES.find((m) => m.id === mode) || MODES[0];
  const hasInput =
    String(question || '').trim().length > 0 ||
    String(studentText || '').trim().length > 0;
  const canSubmit =
    !loading &&
    (mode === 'revise'
      ? hasInput && String(attemptId || '').trim().length > 0
      : hasInput);
  const skill = result?.skill || profile?.skill || 'writing';

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) onSubmit?.();
    }
  };

  return (
    <section className="panel flex flex-col p-4 sm:p-5" aria-labelledby="learn-title">
      <h2 id="learn-title" className="label mb-3">
        Learn Mode
      </h2>

      <div
        role="group"
        aria-label="Learning modes"
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
      >
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              data-mode={m.id}
              aria-pressed={active}
              onClick={() => setMode(m.id)}
              className={`rounded-lg border px-2 py-2.5 text-left transition ${
                active
                  ? 'border-acid-500/50 bg-acid-500/10 shadow-[inset_0_0_0_1px_rgba(184,245,74,0.15)]'
                  : 'border-white/10 bg-ink-950/40 hover:border-white/20'
              }`}
            >
              <div
                className={`font-mono text-xs font-semibold ${
                  active ? 'text-acid-400' : 'text-slate-300'
                }`}
              >
                {m.label}
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-400">{activeMode.hint}</p>

      <label htmlFor="learn-question" className="label mb-1.5 mt-4">
        Question
      </label>
      <input
        id="learn-question"
        className="input"
        type="text"
        value={question || ''}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Paste the IELTS prompt, or leave empty to reuse the prior attempt"
      />

      <label htmlFor="learn-studentText" className="label mb-1.5 mt-3">
        Your attempt
      </label>
      <textarea
        id="learn-studentText"
        className="textarea flex-1"
        value={studentText || ''}
        onChange={(e) => setStudentText(e.target.value)}
        placeholder="Write your PEEL paragraph, or paste a topic to begin..."
        onKeyDown={handleKeyDown}
      />
      <p className="mt-1 text-[11px] text-slate-500">
        Press Enter to submit · Shift+Enter for a newline
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary min-w-[140px]"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-950 border-t-transparent" />
              Working…
            </>
          ) : (
            <>
              <span className="font-mono">⚡</span> Submit
            </>
          )}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setQuestion('');
            setStudentText('');
          }}
          disabled={loading}
        >
          Clear
        </button>
        {profile?.targetBand && (
          <span className="ml-auto text-[11px] text-slate-500">
            target band {profile.targetBand}
          </span>
        )}
      </div>

      <div aria-live="polite" aria-busy={loading} className="mt-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {loading && !error && (
          <div className="text-sm text-slate-400">Analyzing attempt…</div>
        )}

        {!loading && !error && result && (
          <div role="status" className="space-y-3">
            {result.criterionFeedback && (
              <CriterionFeedback feedback={result.criterionFeedback} skill={skill} />
            )}
            {result.content && (
              <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-ink-950/70 p-4 font-mono text-[13px] leading-relaxed text-slate-200">
                {result.content}
              </pre>
            )}
            {result.disclaimer && !result.criterionFeedback && (
              <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-500">
                {result.disclaimer}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
