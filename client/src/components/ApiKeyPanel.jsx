import { useState } from 'react';

export default function ApiKeyPanel({ settings, onChange }) {
  const [showKey, setShowKey] = useState(false);

  return (
    <section className="panel p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="label">API Configuration</h2>
        <span className="text-[11px] text-slate-500">仅存 sessionStorage · 不落盘</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="mb-1.5 block text-xs text-slate-400">API Key *</label>
          <div className="relative">
            <input
              className="input pr-16 font-mono"
              type={showKey ? 'text' : 'password'}
              placeholder="sk-..."
              value={settings.apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              autoComplete="off"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-frost-400 hover:text-acid-400"
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? 'HIDE' : 'SHOW'}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-slate-400">Base URL</label>
          <input
            className="input font-mono text-xs"
            type="text"
            placeholder="https://api.openai.com/v1"
            value={settings.baseUrl}
            onChange={(e) => onChange({ baseUrl: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-slate-400">Model</label>
          <input
            className="input font-mono text-xs"
            type="text"
            placeholder="gpt-4o-mini"
            value={settings.model}
            onChange={(e) => onChange({ model: e.target.value })}
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        兼容 OpenAI Chat Completions。DeepSeek / 硅基流动 / Ollama 等改 Base URL + Model 即可。
      </p>
    </section>
  );
}
