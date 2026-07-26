import { useState } from 'react';
import PeelBlock from './PeelBlock.jsx';
import EvaluationPanel from './EvaluationPanel.jsx';
import EntityHighlighter from './EntityHighlighter.jsx';
import PeelEditor from './PeelEditor.jsx';

export default function ResultPanel({
  result,
  loading,
  error,
  onRevalidate,
  revalidating,
}) {
  const [view, setView] = useState('structured'); // structured | raw | edit

  const peels = result?.parsed?.peels || [];
  const meta = result?.parsed?.meta;
  const model = result?.parsed?.model || result?.reductionModel;
  const raw = result?.content || '';

  const copyAll = async () => {
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="panel flex min-h-[480px] flex-col p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="label">Analysis Output</h2>
        <div className="flex items-center gap-2">
          {result && (
            <>
              <div className="flex rounded-lg border border-white/10 p-0.5 text-[11px]">
                {['structured', 'edit', 'raw'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`rounded-md px-2.5 py-1 ${
                      view === v ? 'bg-white/10 text-white' : 'text-slate-400'
                    }`}
                    onClick={() => setView(v)}
                  >
                    {v === 'structured' ? '结构化' : v === 'edit' ? '编辑' : '原文'}
                  </button>
                ))}
              </div>
              <button type="button" className="btn-ghost !py-1.5 text-[11px]" onClick={copyAll}>
                复制全文
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-acid-500/30 border-t-acid-400" />
          <p className="font-mono text-xs tracking-wide">DETONATING PEEL LOGIC…</p>
        </div>
      )}

      {!loading && !result && !error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-slate-500">
          <div className="font-mono text-3xl text-white/10">[P][E1][E2][L]</div>
          <p className="max-w-xs text-sm">配置 API Key → 选择指令 → 输入题目 → Generate</p>
          <p className="text-[11px]">/score 可无 Key · 输出含质量门禁与实体高亮</p>
        </div>
      )}

      {!loading && result && (
        <div className="flex-1 space-y-3 overflow-auto">
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span className="rounded border border-white/10 px-2 py-0.5 font-mono text-acid-400/90">
              /{result.command}
            </span>
            {result.model && (
              <span className="rounded border border-white/10 px-2 py-0.5 font-mono">
                {result.model}
              </span>
            )}
            {result.usage && (
              <span className="rounded border border-white/10 px-2 py-0.5">
                tokens: {result.usage.total_tokens ?? '—'}
              </span>
            )}
            {result.latencyMs != null && (
              <span className="rounded border border-white/10 px-2 py-0.5">
                {result.latencyMs}ms
              </span>
            )}
          </div>

          {(result.feedback || result.validation) && (
            <EvaluationPanel
              feedback={result.feedback}
              validation={result.validation}
              weak={result.weak}
              topic={result.topic}
              retries={result.retries}
            />
          )}

          {result.entities?.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-ink-950/40 px-3 py-2">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                E2 Entities
              </div>
              <EntityHighlighter entities={result.entities} />
            </div>
          )}

          {view === 'raw' ? (
            <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-ink-950/70 p-4 font-mono text-[13px] leading-relaxed text-slate-200">
              {raw}
            </pre>
          ) : view === 'edit' && peels[0] ? (
            <PeelEditor
              peel={peels[0]}
              saving={revalidating}
              onSave={(lines) => onRevalidate?.(lines)}
            />
          ) : (
            <>
              {model && (model.label || model.name) && (
                <div className="rounded-lg border border-violet-400/20 bg-violet-400/5 px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-violet-300">
                    MODEL {model.id || ''}
                  </span>
                  <p className="mt-1 text-slate-300">{model.label || model.name}</p>
                </div>
              )}

              {meta && (
                <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-sm text-amber-100/90">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/80">
                    底层逻辑
                  </span>
                  <p className="mt-1 leading-relaxed">{meta}</p>
                </div>
              )}

              {peels.length > 0 ? (
                <div className="space-y-3">
                  {peels.map((peel, i) => (
                    <PeelBlock key={i} peel={peel} index={peels.length > 1 ? i : undefined} />
                  ))}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-ink-950/70 p-4 font-mono text-[13px] leading-relaxed text-slate-200">
                  {raw}
                </pre>
              )}

              {peels.length > 0 && raw.includes('##') && (
                <details className="rounded-lg border border-white/10 bg-ink-950/40">
                  <summary className="cursor-pointer px-3 py-2 text-xs text-slate-400 hover:text-slate-200">
                    展开完整原文（含 Matrix 秒杀区等）
                  </summary>
                  <pre className="whitespace-pre-wrap border-t border-white/5 p-4 font-mono text-[12px] leading-relaxed text-slate-300">
                    {raw}
                  </pre>
                </details>
              )}

            </>
          )}

          {result.disclaimer && (
            <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-500">
              {result.disclaimer}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
