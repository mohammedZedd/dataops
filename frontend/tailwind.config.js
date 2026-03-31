/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        payfit: {
          blue: '#1A56DB',
          'blue-light': '#EBF5FF',
          'blue-hover': '#1C46B6',
        }
      }
    },
  },
  plugins: [],
}

