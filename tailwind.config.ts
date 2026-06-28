import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Deep near-black canvas tones.
        canvas: '#08080c',
        panel: '#16161c',
        'panel-2': '#1d1d26',
        'panel-3': '#26262f',
        stroke: '#2e2e3a',
        // Brand violet -> cyan accent.
        brand: '#7c5cff',
        'brand-2': '#a78bfa',
        accent: '#22d3ee',
        track: {
          video: '#3b82f6',
          audio: '#22c55e',
          text: '#f59e0b',
          overlay: '#ec4899',
          sticker: '#a855f7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7c5cff 0%, #22d3ee 100%)',
        'brand-gradient-soft':
          'linear-gradient(135deg, rgba(124,92,255,0.18) 0%, rgba(34,211,238,0.18) 100%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(124,92,255,0.4), 0 8px 30px rgba(124,92,255,0.15)',
        'glow-sm': '0 0 0 1px rgba(124,92,255,0.35), 0 4px 16px rgba(124,92,255,0.18)',
        brand: '0 6px 20px -4px rgba(124,92,255,0.5)',
        panel: '0 10px 40px -12px rgba(0,0,0,0.6)',
        'inner-hairline': 'inset 0 1px 0 0 rgba(255,255,255,0.05)',
      },
      borderRadius: {
        '2xl': '1rem',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
