import { useState, useEffect } from 'react';

const LABELS = [
  { key: 'P', color: 'text-sky-300', label: 'Point' },
  { key: 'E1', color: 'text-violet-300', label: 'Explanation' },
  { key: 'E2', color: 'text-acid-400', label: 'Example' },
  { key: 'L', color: 'text-amber-300', label: 'Link' },
];

export default function PeelEditor({ peel, onSave, saving }) {
  const [lines, setLines] = useState({
    P: peel?.P || '',
    E1: peel?.E1 || '',
    E2: peel?.E2 || '',
    L: peel?.L || '',
  });

  useEffect(() => {
    setLines({
      P: peel?.P || '',
      E1: peel?.E1 || '',
      E2: peel?.E2 || '',
      L: peel?.L || '',
    });
  }, [peel]);

  return (
    <div className="space-y-2">
      {LABELS.map(({ key, color, label }) => (
        <div key={key} className="flex items-start gap-2">
          <span className={`mt-2 min-w-[28px] font-mono text-xs font-semibold ${color}`}>
            [{key}]
          </span>
          <textarea
            className="flex-1 resize-none rounded-md border border-white/10 bg-ink-950/60 px-3 py-2 font-mono text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-acid-500/40"
            rows={key === 'E1' || key === 'E2' ? 3 : 2}
            value={lines[key]}
            onChange={(e) => setLines((prev) => ({ ...prev, [key]: e.target.value }))}
            placeholder={`${label}...`}
          />
        </div>
      ))}
      <button
        type="button"
        className="btn-primary mt-2 text-xs"
        disabled={saving}
        onClick={() => onSave?.(lines)}
      >
        {saving ? 'Validating…' : 'Save & Re-validate'}
      </button>
    </div>
  );
}
