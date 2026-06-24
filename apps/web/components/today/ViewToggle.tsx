'use client';

type ViewMode = 'list' | 'board';

interface Props {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, setMode }: Props) {
  const isActive = (m: ViewMode) => mode === m;

  return (
    <div className="flex gap-1.5">
      {(['list', 'board'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isActive(m)
              ? 'bg-accent text-white'
              : 'text-text-muted hover:text-text-primary bg-transparent hover:bg-surface'
          }`}
          aria-pressed={isActive(m)}
        >
          {m === 'list' ? 'List' : 'Board'}
        </button>
      ))}
    </div>
  );
}
