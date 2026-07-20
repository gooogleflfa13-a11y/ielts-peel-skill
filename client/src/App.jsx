import { useCallback, useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import ApiKeyPanel from './components/ApiKeyPanel.jsx';
import CommandPanel from './components/CommandPanel.jsx';
import ResultPanel from './components/ResultPanel.jsx';

const STORAGE_KEY = 'peel-hacker-settings';

const DEFAULT_SETTINGS = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
};

function loadSettings() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [command, setCommand] = useState('peel');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        model: settings.model,
      })
    );
  }, [settings]);

  const updateSettings = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const handleGenerate = async () => {
    setError('');
    if (!settings.apiKey.trim()) {
      setError('请先输入 API Key。');
      return;
    }
    if (!input.trim() && command !== 'wizard') {
      setError('请输入题目或社会现象。');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: settings.apiKey.trim(),
          baseUrl: settings.baseUrl.trim() || DEFAULT_SETTINGS.baseUrl,
          model: settings.model.trim() || DEFAULT_SETTINGS.model,
          command,
          input: input.trim(),
          history: command === 'wizard' ? history : [],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setResult(data);

      // Wizard multi-turn: keep conversation for follow-up answers
      if (command === 'wizard') {
        const userMsg = input.trim().startsWith('/wizard')
          ? input.trim()
          : `/wizard ${input.trim()}`.trim();
        setHistory((h) => [
          ...h,
          { role: 'user', content: userMsg || '/wizard' },
          { role: 'assistant', content: data.content },
        ]);
      } else {
        setHistory([]);
      }
    } catch (e) {
      setError(e.message || '请求失败');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClearWizard = () => {
    setHistory([]);
    setResult(null);
    setError('');
  };

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Header />

      <div className="mt-6 space-y-4">
        <ApiKeyPanel settings={settings} onChange={updateSettings} />

        <div className="grid gap-4 lg:grid-cols-2">
          <CommandPanel
            command={command}
            setCommand={setCommand}
            input={input}
            setInput={setInput}
            loading={loading}
            onGenerate={handleGenerate}
            onClearWizard={handleClearWizard}
            wizardTurns={history.filter((m) => m.role === 'user').length}
          />
          <ResultPanel result={result} loading={loading} error={error} />
        </div>
      </div>

      <footer className="mt-10 border-t border-white/5 pt-6 text-center text-xs text-slate-500">
        IELTS PEEL Hacker · [P]→[E1]→[E2]→[L] · Zero fluff protocol
      </footer>
    </div>
  );
}
