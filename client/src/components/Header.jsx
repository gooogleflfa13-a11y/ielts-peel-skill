export default function Header() {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-acid-500/30 bg-acid-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-acid-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-acid-400" />
          Agent Online
        </div>
        <h1 className="font-mono text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          IELTS <span className="text-acid-400">PEEL</span> Hacker
        </h1>
        <p className="mt-1 max-w-xl text-sm text-slate-400">
          冷酷法学导师 · 四句锁死逻辑生成器 · 大作文 Body / 口语 Part 3
        </p>
      </div>
      <div className="flex flex-wrap gap-2 font-mono text-[11px] text-frost-400">
        <span className="rounded border border-white/10 bg-ink-800 px-2 py-1">/peel</span>
        <span className="rounded border border-white/10 bg-ink-800 px-2 py-1">/matrix</span>
        <span className="rounded border border-white/10 bg-ink-800 px-2 py-1">/wizard</span>
      </div>
    </header>
  );
}
