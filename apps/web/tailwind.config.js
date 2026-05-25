/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        line: '#d9dee8',
        panel: '#f7f8fa',
        accent: '#0f766e'
      }
    }
  },
  plugins: []
};
