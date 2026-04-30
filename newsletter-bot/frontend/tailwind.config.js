/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#1a56db',
          700: '#1d4ed8',
          900: '#1e3a5f',
        },
        slate: {
          850: '#1a2436',
          950: '#0a0f1a',
        },
      },
    },
  },
  plugins: [],
}
