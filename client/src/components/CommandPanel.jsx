const COMMANDS = [
  {
    id: 'peel',
    label: '/peel',
    title: '单点逻辑爆破',
    hint: '输入具体雅思题目 → 四句全英文 PEEL + 一行中文底层逻辑',
    placeholder:
      'e.g. Some people believe online education can replace traditional classrooms. To what extent do you agree or disagree?',
  },
  {
    id: 'matrix',
    label: '/matrix',
    title: '降维打穿器',
    hint: '输入社会现象 → 匹配三大模型 → 横向秒杀 3 道同类题',
    placeholder: 'e.g. 年轻人沉迷短视频 / people prefer online shopping to physical stores',
  },
  {
    id: 'wizard',
    label: '/wizard',
    title: '基准剧本生成器',
    hint: '可附题库关键词；Agent 先反问 3–4 个生活细节，再生成母剧本',
    placeholder: 'e.g. 教育+科技题库 / education & technology topics（先发一次拿问题，再回填细节）',
  },
];

const SAMPLES = {
  peel: 'Governments should spend more money on public services rather than arts. Discuss both views and give your opinion.',
  matrix: 'community relationships are weaker than in the past',
  wizard: '城市化 + 科技口语题库',
};

export default function CommandPanel({
  command,
  setCommand,
  input,
  setInput,
  loading,
  onGenerate,
  onClearWizard,
  wizardTurns,
}) {
  const meta = COMMANDS.find((c) => c.id === command) || COMMANDS[0];

  return (
    <section className="panel flex flex-col p-4 sm:p-5">
      <h2 className="label mb-3">Interactive Commands</h2>

      <div className="grid grid-cols-3 gap-2">
        {COMMANDS.map((c) => {
          const active = command === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCommand(c.id)}
              className={`rounded-lg border px-2 py-3 text-left transition ${
                active
                  ? 'border-acid-500/50 bg-acid-500/10 shadow-[inset_0_0_0_1px_rgba(184,245,74,0.15)]'
                  : 'border-white/10 bg-ink-950/40 hover:border-white/20'
              }`}
            >
              <div className={`font-mono text-xs font-semibold ${active ? 'text-acid-400' : 'text-slate-300'}`}>
                {c.label}
              </div>
              <div className="mt-1 text-[10px] leading-snug text-slate-500">{c.title}</div>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-400">{meta.hint}</p>

      {command === 'wizard' && wizardTurns > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-lg border border-acid-500/20 bg-acid-500/5 px-3 py-2 text-xs text-acid-400">
          <span>Wizard 多轮已记录 {wizardTurns} 轮用户输入</span>
          <button type="button" className="underline hover:text-acid-300" onClick={onClearWizard}>
            清空会话
          </button>
        </div>
      )}

      <label className="label mb-1.5 mt-4">Input</label>
      <textarea
        className="textarea flex-1"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={meta.placeholder}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            onGenerate();
          }
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary min-w-[140px]" disabled={loading} onClick={onGenerate}>
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-950 border-t-transparent" />
              Generating…
            </>
          ) : (
            <>
              <span className="font-mono">⚡</span> Generate
            </>
          )}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setInput(SAMPLES[command] || '')}
          disabled={loading}
        >
          填入样例
        </button>
        <button type="button" className="btn-ghost" onClick={() => setInput('')} disabled={loading}>
          清空
        </button>
        <span className="ml-auto text-[11px] text-slate-500">⌘/Ctrl + Enter</span>
      </div>
    </section>
  );
}
