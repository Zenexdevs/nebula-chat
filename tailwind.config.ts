import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          950: '#05050a',
          900: '#0a0a14',
          800: '#0f0f1e',
          700: '#161628',
        },
        neon: {
          cyan: '#00f0ff',
          purple: '#a855f7',
          pink: '#ff2fd0',
          blue: '#3b82f6',
        },
      },
      boxShadow: {
        neon: '0 0 20px rgba(0, 240, 255, 0.35), 0 0 40px rgba(168, 85, 247, 0.15)',
        'neon-pink': '0 0 20px rgba(255, 47, 208, 0.35)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 10px rgba(0,240,255,0.6)' },
          '50%': { opacity: '0.6', boxShadow: '0 0 24px rgba(0,240,255,0.9)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        shimmer: 'shimmer 1.5s linear infinite',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
