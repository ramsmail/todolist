'use client';

interface Props {
  originalTitle: string | null;
  hasOriginal: boolean;
  onOpenOriginal: () => void;
  onDeleteCopy: () => void;
}

export function ConflictBanner({ originalTitle, hasOriginal, onOpenOriginal, onDeleteCopy }: Props) {
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-warning bg-warning/10 px-4 py-3">
      <p className="text-sm text-text-primary">
        {hasOriginal
          ? <>Conflict copy of <strong>{originalTitle || 'Untitled'}</strong>. Compare and merge, then delete.</>
          : <>Conflict copy of a note that no longer exists.</>}
      </p>
      <div className="flex gap-2 flex-shrink-0">
        {hasOriginal && (
          <button type="button" onClick={onOpenOriginal} className="text-sm text-accent hover:underline">
            Open original
          </button>
        )}
        <button type="button" onClick={onDeleteCopy} className="text-sm text-error hover:underline">
          Delete copy
        </button>
      </div>
    </div>
  );
}
