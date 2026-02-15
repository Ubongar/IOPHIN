/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'risk-high': '#EF4444',
        'risk-medium': '#F59E0B',
        'risk-low': '#10B981',
        'risk-minimal': '#3B82F6',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
