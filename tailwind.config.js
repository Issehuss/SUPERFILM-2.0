/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  safelist: [
    'perspective',
    'backface-hidden',
    'transform-style-preserve-3d',
    'rotate-y-180',
  ],
  plugins: [
    require('@tailwindcss/aspect-ratio'),
  ],
};
