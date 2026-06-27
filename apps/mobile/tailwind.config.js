/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        nouri: {
          green: '#1A6B3C',
          light: '#27A85F',
          bg: '#F8FAF9',
        },
      },
    },
  },
  plugins: [],
};
