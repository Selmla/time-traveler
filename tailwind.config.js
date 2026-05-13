/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surface scale — all backed by CSS variables for day/night theme switching.
        // Night: dark navy. Day: inverted light slate. Variables defined in index.css.
        surface: {
          900: 'rgb(var(--surface-900) / <alpha-value>)',
          800: 'rgb(var(--surface-800) / <alpha-value>)',
          700: 'rgb(var(--surface-700) / <alpha-value>)',
          600: 'rgb(var(--surface-600) / <alpha-value>)',
          500: 'rgb(var(--surface-500) / <alpha-value>)',
          400: 'rgb(var(--surface-400) / <alpha-value>)',
          300: 'rgb(var(--surface-300) / <alpha-value>)',
          200: 'rgb(var(--surface-200) / <alpha-value>)',
          100: 'rgb(var(--surface-100) / <alpha-value>)',
        },
        // Status colors — variable-backed so day mode can darken them for light-bg readability.
        // Night: standard vivid. Day: one shade darker for WCAG contrast on white.
        status: {
          ok:        'rgb(var(--status-ok) / <alpha-value>)',
          tight:     'rgb(var(--status-tight) / <alpha-value>)',
          at_risk:   'rgb(var(--status-at_risk) / <alpha-value>)',
          missed:    'rgb(var(--status-missed) / <alpha-value>)',
          completed: 'rgb(var(--status-completed) / <alpha-value>)',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
  safelist: [
    'text-status-ok',
    'text-status-tight',
    'text-status-at_risk',
    'text-status-missed',
    'text-status-completed',
    'bg-status-ok',
    'bg-status-tight',
    'bg-status-at_risk',
    'bg-status-missed',
    'bg-status-completed',
    'border-status-ok',
    'border-status-tight',
    'border-status-at_risk',
    'border-status-missed',
    'border-status-completed',
  ]
}
