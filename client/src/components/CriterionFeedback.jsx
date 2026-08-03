const WRITING_DIMENSIONS = [
  { key: 'TR', label: 'Task Response' },
  { key: 'CC', label: 'Coherence & Cohesion' },
  { key: 'LR', label: 'Lexical Resource' },
  { key: 'GRA', label: 'Grammatical Range & Accuracy' },
];

const SPEAKING_DIMENSIONS = [
  { key: 'FC', label: 'Fluency & Coherence' },
  { key: 'LR', label: 'Lexical Resource' },
  { key: 'GRA', label: 'Grammatical Range & Accuracy' },
  { key: 'PR', label: 'Pronunciation' },
];

const STATUS_CLASS = {
  pass: 'border-acid-500/30 text-acid-400',
  watch: 'border-amber-500/30 text-amber-400',
  fail: 'border-red-500/30 text-red-400',
  not_assessed: 'border-white/15 text-slate-400',
};

const DEFAULT_DISCLAIMER =
  'Formative feedback based on official IELTS criteria. Not an official assessment or band prediction.';

export default function CriterionFeedback({ feedback, skill = 'writing' }) {
  if (!feedback) return null;
  const isSpeaking = skill === 'speaking';
  const dimensions = isSpeaking ? SPEAKING_DIMENSIONS : WRITING_DIMENSIONS;
  const criteria = feedback.criteria || {};
  const disclaimer = feedback.disclaimer || DEFAULT_DISCLAIMER;

  return (
    <div
      className="rounded-lg border border-white/10 bg-ink-950/40 p-3"
      aria-labelledby="criterion-title"
    >
      <h3 id="criterion-title" className="label mb-2">
        Criterion Feedback · {isSpeaking ? 'Speaking' : 'Writing'}
      </h3>
      <ul className="space-y-2">
        {dimensions.map((d) => {
          const entry = criteria[d.key] || { status: 'not_assessed', notes: '' };
          const status = entry.status || 'not_assessed';
          return (
            <li key={d.key} className="rounded-lg border border-white/10 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-slate-300">
                  <strong>{d.key}</strong> · {d.label}
                </span>
                <span
                  data-criterion-status={status}
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    STATUS_CLASS[status] || STATUS_CLASS.not_assessed
                  }`}
                >
                  {status}
                </span>
              </div>
              {entry.notes ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{entry.notes}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p
        data-disclaimer={disclaimer}
        className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-500"
      >
        {disclaimer}
      </p>
    </div>
  );
}
