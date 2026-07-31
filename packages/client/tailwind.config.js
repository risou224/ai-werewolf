/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        werewolf: {
          bg: '#0f0f1a',
          card: '#1a1a2e',
          accent: '#e94560',
          gold: '#ffd700',
          alive: '#22c55e',
          dead: '#6b7280',
        },
      },
    },
  },
  plugins: [],
};
