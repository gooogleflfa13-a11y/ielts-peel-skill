const COMMANDS = [
  {
    id: 'peel',
    label: '/peel',
    title: '单点逻辑爆破',
    hint: '输入具体雅思题目 → 四句全英文 PEEL + 一行中文底层逻辑 + 质量门禁',
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
  {
    id: 'score',
    label: '/score',
    title: 'PEEL 评分',
    hint: '粘贴你的 PEEL（带 [P][E1][E2][L] 或四行）→ 程序化质检，无需调 LLM（可选 AI 语义分）',
    placeholder:
      '[P] ...\n[E1] ...\n[E2] ...\n[L] ...',
  },
  {
    id: 'bank',
    label: '/bank',
    title: '题库底仓',
    hint: '内嵌口语题仓（非独立文件）：random 抽题 · links 横纵 · peel 隐式取题作答 · search / stats',
    placeholder:
      'random p3\nrandom p2 traffic\nsearch music\nlinks building\npeel <ref>\nstats',
  },
];

const SAMPLES = {
  peel: 'Governments should spend more money on public services rather than arts. Discuss both views and give your opinion.',
  matrix: 'community relationships are weaker than in the past',
  wizard: '城市化 + 科技口语题库',
  score: `[P] The absence of physical schooling breeds deficits in social competency.
[E1] This means young people miss the daily peer-to-peer negotiations that teach conflict resolution and empathy.
[E2] Take university seminar rooms: students who study entirely online never build the impromptu study groups at whiteboards that become lifelong professional networks.
[L] Thus, physical attendance plays an irreplaceable role in holistic education.`,
  bank: 'random p3',
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
  needsApiKey = true,
}) {
  const meta = COMMANDS.find((c) => c.id === command) || COMMANDS[0];

  return (
    <section className="panel flex flex-col p-4 sm:p-5">
      <h2 className="label mb-3">Interactive Commands</h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              <div
                className={`font-mono text-xs font-semibold ${
                  active ? 'text-acid-400' : 'text-slate-300'
                }`}
              >
                {c.label}
              </div>
              <div className="mt-1 text-[10px] leading-snug text-slate-500">{c.title}</div>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-400">{meta.hint}</p>
      {!needsApiKey && command === 'score' && (
        <p className="mt-1 text-[11px] text-acid-400/80">/score 默认不调用 LLM，无需 API Key</p>
      )}

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
              <span className="font-mono">⚡</span>{' '}
              {command === 'score' ? 'Score' : 'Generate'}
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
