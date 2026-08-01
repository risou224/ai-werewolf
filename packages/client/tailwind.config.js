/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        werewolf: {
          bg: '#0a0a16',
          card: '#14142a',
          accent: '#e94560',
          gold: '#ffd24d',
          alive: '#22c55e',
          dead: '#6b7280',
        },
        // 手游狼人杀风格色板
        night: {
          950: '#05050d',
          900: '#0a0a16',
          800: '#10101f',
          700: '#181830',
          600: '#23234a',
        },
        gold: {
          300: '#ffe9a8',
          400: '#ffd24d',
          500: '#f0b429',
          600: '#c9941f',
        },
        wolfred: {
          400: '#ff5c6c',
          500: '#e94560',
          600: '#c62f4a',
        },
        // 身份色（手游风，柔和高饱和）
        role: {
          wolf: '#ff5c6c',
          seer: '#a78bfa',
          witch: '#34d399',
          hunter: '#fb923c',
          idiot: '#38bdf8',
          villager: '#94a3b8',
        },
        camp: {
          good: '#4ade80',
          evil: '#ff5c6c',
        },
      },
      borderRadius: {
        card: '14px',
        badge: '999px',
      },
      boxShadow: {
        'gold-glow': '0 0 12px rgba(255, 210, 77, 0.35), 0 0 32px rgba(255, 210, 77, 0.12)',
        'card-glow': '0 4px 24px rgba(0, 0, 0, 0.45)',
        'role-glow': '0 0 14px rgba(255, 210, 77, 0.25)',
      },
      keyframes: {
        'float-y': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(255, 210, 77, 0.5)' },
          '70%': { boxShadow: '0 0 0 10px rgba(255, 210, 77, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(255, 210, 77, 0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'float-y': 'float-y 3s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        'pop-in': 'pop-in 0.25s ease-out',
        'spin-slow': 'spin-slow 40s linear infinite',
      },
    },
  },
  plugins: [],
};
