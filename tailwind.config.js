/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        workshop: {
          bg: '#0B0F17',
          card: '#161F30',
          cardHover: '#1E293B',
          border: '#26344D',
          amber: '#F59E0B',
          amberLight: '#FBBF24',
          emerald: '#10B981',
          crimson: '#EF4444',
          ukPlate: '#FFCC00',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        plate: ['"Charles Wright"', '"Arial Black"', 'Impact', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
