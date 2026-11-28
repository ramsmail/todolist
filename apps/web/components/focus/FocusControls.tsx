interface Props {
  isRunning:    boolean;
  canStart:     boolean;
  onPlayPause:  () => void;
  onReset:      () => void;
  onSkip:       () => void;
}

export function FocusControls({ isRunning, canStart, onPlayPause, onReset, onSkip }: Props) {
  return (
    <div className="focus-mode-controls">
      <button aria-label="Reset" onClick={onReset} className="focus-mode-icon-btn">↺</button>
      <button
        aria-label={isRunning ? 'Pause' : 'Play'}
        onClick={onPlayPause}
        disabled={!isRunning && !canStart}
        className="focus-mode-icon-btn focus-mode-icon-btn--primary"
      >
        {isRunning ? '⏸' : '▶'}
      </button>
      <button aria-label="Skip" onClick={onSkip} className="focus-mode-icon-btn">⏭</button>
    </div>
  );
}
