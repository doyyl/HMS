/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm front-desk palette: deep teal ink + amber accent on bone.
        ink: {
          DEFAULT: '#0f2a30',
          soft: '#1c3d44',
        },
        bone: '#f6f1e7',
        sand: '#ece3d2',
        amber: {
          brand: '#c4862f',
          deep: '#9c6418',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,42,48,0.06), 0 8px 24px -12px rgba(15,42,48,0.25)',
      },
    },
  },
  plugins: [],
};
