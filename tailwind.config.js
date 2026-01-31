/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#1a2332',
        },
        charcoal: {
          800: '#2d3748',
        },
        profBlue: {
          800: '#2c5282',
          600: '#3182ce',
        },
        gold: {
          500: '#d4af37',
          100: 'rgba(212, 175, 55, 0.2)',
        },
        slate: {
          600: '#4a5568',
          500: '#718096',
          400: '#a0aec0',
        },
        lightGray: {
          100: '#f7fafc',
          200: '#e2e8f0',
          300: '#cbd5e0',
        },
        success: {
          green: '#38a169',
          bg: '#c6f6d5',
          text: '#22543d',
        },
        error: {
          red: '#e53e3e',
          bg: '#fff5f5',
        },
        progress: {
          blue: '#4299e1',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      }
    }
  },
  plugins: [],
}
