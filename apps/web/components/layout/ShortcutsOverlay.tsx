'use client';

import { useShortcuts } from '@/lib/shortcuts/ShortcutContext';

export function ShortcutsOverlay() {
  const { shortcutsOpen, closeShortcuts } = useShortcuts();

  if (!shortcutsOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeShortcuts();
      }}
    >
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4">
        <h2 id="shortcuts-title" className="text-2xl font-bold mb-4">
          Keyboard Shortcuts
        </h2>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-700">Quick Capture</span>
            <kbd className="px-2 py-1 bg-gray-200 rounded">Cmd+Enter</kbd>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-700">Open Filters</span>
            <kbd className="px-2 py-1 bg-gray-200 rounded">Cmd+/</kbd>
          </div>
        </div>
        <button
          onClick={closeShortcuts}
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}
