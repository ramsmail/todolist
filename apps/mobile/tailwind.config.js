/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: '#6366F1',
        surface: '#141414',
        'surface-alt': '#1C1C1C',
        border: '#272727',
      },
    },
  },
  plugins: [],
};
