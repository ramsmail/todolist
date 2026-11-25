'use client';

export interface PickerResult {
  id: string;
  label: string;
}

interface Props {
  label: string;
  term: string;
  onTermChange: (term: string) => void;
  results: PickerResult[];
  onPick: (id: string) => void;
  onClose: () => void;
}

export function SearchPicker({ label, term, onTermChange, results, onPick, onClose }: Props) {
  return (
    <div className="mt-2 bg-surface border border-border rounded-xl p-2">
      <input
        autoFocus
        aria-label={label}
        placeholder={label}
        value={term}
        onChange={(e) => onTermChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            // keep the surrounding panel (which closes on Escape) open
            e.nativeEvent.stopPropagation();
            onClose();
          }
        }}
        className="w-full bg-surface-alt border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
      />
      {term.trim() !== '' &&
        (results.length === 0 ? (
          <p className="px-2 py-2 text-xs text-text-muted">No matches</p>
        ) : (
          <ul className="mt-1 max-h-48 overflow-y-auto scrollable">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r.id)}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-text-primary hover:bg-surface-alt truncate"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
