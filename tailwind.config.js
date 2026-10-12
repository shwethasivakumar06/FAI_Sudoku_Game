/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 20px 50px rgba(79, 70, 229, 0.25)',
      },
      colors: {
        navy: '#07142d',
        midnight: '#111827',
        indigoGlow: '#6d5efc',
      },
    },
  },
  plugins: [],
};
