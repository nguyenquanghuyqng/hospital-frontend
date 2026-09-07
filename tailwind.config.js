/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#EBF4FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#0066CC',
          700: '#004A99',
          800: '#003070',
          900: '#1E3A5F',
          DEFAULT: '#0066CC',
        },
        secondary: {
          DEFAULT: '#00B4A0',
          dark:    '#008B7A',
          bg:      '#E6FAF8',
        },
        status: {
          waiting:  '#F59E0B',
          calling:  '#EF4444',
          serving:  '#10B981',
          done:     '#6B7280',
          skipped:  '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow':    'pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite',
        'number-glow':   'numberGlow 2s ease-in-out infinite alternate',
        'slide-in-right':'slideInRight 0.3s ease',
        'slide-up':      'slideUp 0.2s ease',
        'fade-in':       'fadeIn 0.15s ease',
        'marquee':       'marquee 25s linear infinite',
      },
      keyframes: {
        numberGlow: {
          from: { filter: 'drop-shadow(0 0 20px rgba(251,191,36,.3))' },
          to:   { filter: 'drop-shadow(0 0 50px rgba(251,191,36,.7))' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(30px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-50%)' },
        },
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0,0,0,.07), 0 2px 4px -1px rgba(0,0,0,.04)',
        'modal': '0 20px 25px -5px rgba(0,0,0,.08), 0 10px 10px -5px rgba(0,0,0,.03)',
      },
    },
  },
  plugins: [],
}
