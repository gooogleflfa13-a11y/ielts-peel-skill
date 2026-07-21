export default function EvaluationPanel({ validation, weak, topic, retries }) {
  if (!validation) return null;

  const { summary, allWarnings = [], passed } = validation;

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
          {passed ? '✓ QUALITY PASS' : '⚠ QUALITY GATE'}
        </span>
        {summary && (
          <span className="text-[11px] text-slate-500">
            structure: {(summary.structure ?? 0).toFixed(1)} | layers:{' '}
            {(summary.layers ?? 0).toFixed(1)} | physical:{' '}
            {(summary.physical ?? 0).toFixed(1)}
          </span>
        )}
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
      {allWarnings.length > 0 && (
        <ul className="space-y-1">
          {allWarnings.map((w, i) => (
            <li key={i} className="text-[11px] leading-relaxed text-amber-300/90">
              • {w}
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
