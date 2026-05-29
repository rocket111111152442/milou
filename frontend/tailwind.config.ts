import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        milou: {
          bg: '#0a0e17',
          card: '#111827',
          border: '#1f2937',
          neon: '#22d3ee',
          accent: '#a78bfa',
          success: '#34d399',
          danger: '#f87171',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 20px rgba(34, 211, 238, 0.15)',
        'neon-strong': '0 0 30px rgba(34, 211, 238, 0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
