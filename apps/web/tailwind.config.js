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
        bg:            '#0A0A0A',
        surface:       '#141414',
        'surface-alt': '#1C1C1C',
        border:        '#272727',
        'text-primary':   '#F9FAFB',
        'text-secondary': '#9CA3AF',
        'text-muted':     '#6B7280',
        success:       '#22C55E',
        warning:       '#F59E0B',
        error:         '#EF4444',
        sidebar:       '#0D0D0D',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
