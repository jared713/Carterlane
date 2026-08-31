import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Portland stone, the material St Paul's is built from.
        stone: {
          50: '#faf8f4',
          100: '#f3efe7',
          200: '#e6dfd1',
          300: '#d2c7b2',
          400: '#b3a488',
          500: '#94815f',
          600: '#7a6a4d',
          700: '#5f523d',
          800: '#413a2d',
          900: '#26221b',
          950: '#15130f',
        },
        ink: '#14161a',
        brass: '#a8853f',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'ui-serif', 'serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        widest: '0.24em',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 1.2s ease both',
      },
    },
  },
  plugins: [],
};

export default config;
