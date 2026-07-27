const WRITING_DIMENSIONS = [
  { key: 'taskResponse', code: 'TR', label: 'Task Response' },
  { key: 'coherence', code: 'CC', label: 'Coherence & Cohesion' },
  { key: 'lexical', code: 'LR', label: 'Lexical Resource' },
  { key: 'grammar', code: 'GRA', label: 'Grammatical Range & Accuracy' },
];

const SPEAKING_DIMENSIONS = [
  { key: 'fluency', code: 'FC', label: 'Fluency & Coherence' },
  { key: 'lexical', code: 'LR', label: 'Lexical Resource' },
  { key: 'grammar', code: 'GRA', label: 'Grammatical Range & Accuracy' },
  { key: 'pronunciation', code: 'PR', label: 'Pronunciation' },
];

const STATUS_CLASS = {
  pass: 'border-acid-500/30 text-acid-400',
  watch: 'border-amber-500/30 text-amber-400',
  fail: 'border-red-500/30 text-red-400',
};

const DISCLAIMER =
  'Formative feedback based on official IELTS criteria. Not an official assessment or band prediction.';

export default function CriterionFeedback({ feedback, skill = 'writing' }) {
  if (!feedback) return null;
  const isSpeaking = skill === 'speaking';
  const dimensions = isSpeaking ? SPEAKING_DIMENSIONS : WRITING_DIMENSIONS;
  const source = isSpeaking ? feedback.speaking : feedback.writing;
  if (!source) return null;

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
          const entry = source[d.key] || { status: 'watch', notes: '' };
          const status = entry.status || 'watch';
          return (
            <li key={d.key} className="rounded-lg border border-white/10 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-slate-300">
                  <strong>{d.code}</strong> · {d.label}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    STATUS_CLASS[status] || STATUS_CLASS.watch
                  }`}
                  data-criterion-status={status}
                >
                  {status}
                </span>
              </div>
              {entry.notes ? (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {entry.notes}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p
        data-disclaimer
        className="mt-3 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-500"
      >
        {feedback.disclaimer || DISCLAIMER}
      </p>
    </div>
  );
}
