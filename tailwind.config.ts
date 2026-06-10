import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0b1020', 2: '#10172a' },
        panel: { DEFAULT: 'rgba(18,25,42,0.88)', 2: 'rgba(15,21,35,0.92)' },
        surface: { DEFAULT: '#151d31', 2: '#1a243b' },
        accent: { DEFAULT: '#7c5cff', 2: '#16c0d8' },
        verdict: {
          strong: '#22c55e',
          playable: '#14b8a6',
          borderline: '#f59e0b',
          fragile: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        panel: '28px',
        card: '22px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};

export default config;
