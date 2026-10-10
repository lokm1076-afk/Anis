/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fdf8e7',
          100: '#faefc4',
          200: '#f5df8c',
          300: '#efcb52',
          400: '#e8b92a',
          500: '#d4a017',
          600: '#b07f10',
          700: '#8a5f10',
          800: '#6f4a14',
          900: '#5c3e15',
        },
        ink: { DEFAULT: '#111111', 800: '#1b1b1b', 700: '#262626', 600: '#3a3a3a' },
        brand: 'var(--brand, #d4a017)',
      },
      fontFamily: {
        sans: ['"Cairo"', '"Tajawal"', 'system-ui', 'sans-serif'],
        display: ['"Cairo"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
