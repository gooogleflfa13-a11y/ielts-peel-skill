const ENTITY_COLORS = {
  people: 'bg-violet-500/20 text-violet-300',
  scene: 'bg-cyan-500/20 text-cyan-300',
  object: 'bg-amber-500/20 text-amber-300',
  abstract: 'bg-slate-500/20 text-slate-400',
};

export default function EntityHighlighter({ entities }) {
  if (!entities || entities.length === 0) {
    return <div className="text-[11px] text-slate-500">No E2 entities detected</div>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {entities.map((e, i) => (
        <span
          key={`${e.word}-${i}`}
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
            ENTITY_COLORS[e.type] || ENTITY_COLORS.abstract
          }`}
          title={e.topic || ''}
        >
          {e.word}
        </span>
      ))}
    </div>
  );
}
