import { useState } from 'react';

export default function ApiKeyPanel({ settings, onChange }) {
  const [showKey, setShowKey] = useState(false);

  return (
    <section className="panel p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="label">API Configuration</h2>
        <span className="text-[11px] text-slate-500">仅存 sessionStorage · 不落盘</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="api-key" className="mb-1.5 block text-xs text-slate-400">
            API Key <span aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <input
              id="api-key"
              className="input pr-16 font-mono"
              type={showKey ? 'text' : 'password'}
              placeholder="sk-..."
              value={settings.apiKey}
              onChange={(e) => onChange({ apiKey: e.target.value })}
              autoComplete="off"
              aria-required="true"
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
          <label htmlFor="model" className="mb-1.5 block text-xs text-slate-400">Model</label>
          <input
            id="model"
            className="input font-mono text-xs"
            type="text"
            placeholder="gpt-4o-mini"
            value={settings.model}
            onChange={(e) => onChange({ model: e.target.value })}
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Provider endpoint is configured by the server. The API key remains session-only.
      </p>
    </section>
  );
}
