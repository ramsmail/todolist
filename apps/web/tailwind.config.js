/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent:        '#6366F1',
        'accent-dark': '#4F46E5',
        p1:            '#EF4444',
        p2:            '#F97316',
        p3:            '#3B82F6',
        p4:            '#9CA3AF',
        bg:            '#FAFAF8',
        surface:       '#FFFFFF',
        'surface-alt': '#F3F2F0',
        border:        '#E5E3E1',
        'text-primary':   '#1F2937',
        'text-secondary': '#6B7280',
        'text-muted':     '#9CA3AF',
        success:       '#10B981',
        warning:       '#F59E0B',
        error:         '#EF4444',
        sidebar:       '#F9F9F7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
