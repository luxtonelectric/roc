/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [],
  theme: {
    extend: {
      height: {
        'pb': '94%',
      },
      animation: {
        typewriter: "typewriter 5s steps(4) forwards infinite"
      },
      keyframes: {
        typewriter: {
          to: {
            left: "100%"
          }
        }
      }
    },
    container: {
      center: true,
      padding: '2rem',
    },
  },
  plugins: [],
}