const LAYERS = [
  { key: 'P', name: 'Point', sub: '卫星 · 抽象定调', color: 'border-sky-400/40 bg-sky-400/10 text-sky-300' },
  { key: 'E1', name: 'Explanation', sub: '无人机 · 因果机制', color: 'border-violet-400/40 bg-violet-400/10 text-violet-300' },
  { key: 'E2', name: 'Example', sub: '显微镜 · 物理实体', color: 'border-acid-500/40 bg-acid-500/10 text-acid-400' },
  { key: 'L', name: 'Link', sub: '返航 · 逻辑闭环', color: 'border-amber-400/40 bg-amber-400/10 text-amber-300' },
];

export default function PeelBlock({ peel, index }) {
  if (!peel) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-ink-950/60">
      {typeof index === 'number' && (
        <div className="border-b border-white/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
          PEEL UNIT #{index + 1}
        </div>
      )}
      <div className="divide-y divide-white/5">
        {LAYERS.map((layer) => (
          <div key={layer.key} className="flex gap-3 p-3 sm:p-4">
            <div className={`shrink-0 self-start rounded-md border px-2 py-1 font-mono text-xs font-bold ${layer.color}`}>
              {layer.key}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-semibold text-slate-300">{layer.name}</span>
                <span className="text-[10px] text-slate-500">{layer.sub}</span>
              </div>
              <p className="font-mono text-[13px] leading-relaxed text-slate-100">
                {peel[layer.key] || '—'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
