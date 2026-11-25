'use client';

export type ToolbarAction = 'bold' | 'italic' | 'heading' | 'list' | 'checkbox' | 'link' | 'task';

const BUTTONS: { action: Exclude<ToolbarAction, 'task'>; label: string; text: string }[] = [
  { action: 'bold', label: 'Bold', text: 'B' },
  { action: 'italic', label: 'Italic', text: 'I' },
  { action: 'heading', label: 'Heading', text: 'H' },
  { action: 'list', label: 'Bulleted list', text: '•' },
  { action: 'checkbox', label: 'Checkbox list', text: '☑' },
  { action: 'link', label: 'Insert link', text: '🔗' },
];

interface Props {
  onAction: (action: ToolbarAction) => void;
  canMakeTask: boolean;
}

const BTN = 'px-2 py-1 text-sm rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors';

export function MarkdownToolbar({ onAction, canMakeTask }: Props) {
  return (
    <div role="toolbar" aria-label="Formatting" className="flex items-center gap-1 flex-wrap">
      {BUTTONS.map((b) => (
        <button
          key={b.action}
          type="button"
          aria-label={b.label}
          // keep focus and the selection in the textarea
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onAction(b.action)}
          className={BTN}
        >
          {b.text}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
      <button
        type="button"
        aria-label="Selection to task"
        disabled={!canMakeTask}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onAction('task')}
        className={`${BTN} disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        → Task
      </button>
    </div>
  );
}
