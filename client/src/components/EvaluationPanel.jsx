const CHECK_LABELS = {
  labels: 'Labels',
  layerBoundaries: 'Layer boundaries',
  e2Concreteness: 'E2 concreteness',
  linkClosure: 'Link closure',
  bannedGlue: 'Banned glue',
};

export default function EvaluationPanel({ feedback, validation, weak, topic, retries }) {
  if (!feedback && !validation) return null;

  const structuralReview = Boolean(feedback);
  const passed = structuralReview
    ? feedback.status === 'no_issues_detected'
    : validation.passed;
  const issues = structuralReview
    ? feedback.issues || []
    : (validation.allWarnings || []).map((warning) => ({ evidence: warning }));

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        passed
          ? 'border-acid-500/30 bg-acid-500/5'
          : 'border-amber-500/30 bg-amber-500/5'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`font-mono text-xs font-semibold ${
            passed ? 'text-acid-400' : 'text-amber-400'
          }`}
        >
          {structuralReview
            ? passed ? 'PEEL STRUCTURE REVIEW: CLEAR' : 'PEEL STRUCTURE REVIEW: REVISE'
            : passed ? 'QUALITY PASS' : 'QUALITY GATE'}
        </span>
        {topic?.id && (
          <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-frost-400">
            topic:{topic.id}
          </span>
        )}
        {typeof retries === 'number' && retries > 0 && (
          <span className="rounded border border-violet-400/30 px-1.5 py-0.5 font-mono text-[10px] text-violet-300">
            auto-retry×{retries}
          </span>
        )}
      </div>
      {structuralReview && (
        <dl className="mb-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
          {Object.entries(feedback.checks || {}).map(([name, status]) => (
            <div key={name} className="flex items-center gap-1.5 text-[11px]">
              <dt className="text-slate-400">{CHECK_LABELS[name] || name}</dt>
              <dd className={status === 'pass' ? 'text-acid-400' : 'text-amber-400'}>
                {status.toUpperCase()}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {issues.length > 0 && (
        <ul className="space-y-1">
          {issues.map((issue, i) => (
            <li key={i} className="text-[11px] leading-relaxed text-amber-300/90">
              <span>{issue.layer ? `${issue.layer}: ` : ''}{issue.evidence}</span>
              {issue.action && <span className="block text-slate-400">Revise: {issue.action}</span>}
            </li>
          ))}
        </ul>
      )}
      {weak && (
        <div className="mt-2 rounded bg-white/5 px-2 py-1.5 text-[11px] text-slate-400">
          {weak}
        </div>
      )}
    </div>
  );
}
