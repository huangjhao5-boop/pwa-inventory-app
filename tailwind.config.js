/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        warehouse: {
          dark: '#0f172a',
          surface: '#1e293b',
          border: '#334155',
          accent: '#3b82f6',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        }
      },
      screens: {
        'print': { 'raw': 'print' },
      }
    },
  },
  plugins: [],
}
