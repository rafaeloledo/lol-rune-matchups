/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./static/index.html",
    "./frontend/src/**/*.ts",
  ],
  theme: {
    extend: {
      colors: {
        // Parchment palette mirrors the original styles.css.
        parchment: {
          50: "#fffaf2",
          100: "#f5f1e8",
          200: "#f4e9d4",
          300: "#dfd4c2",
          400: "#d6c4a3",
        },
        gold: {
          400: "#c8a16a",
          500: "#9f5f2a",
        },
        ink: {
          DEFAULT: "#1f2630",
          soft: "#53606d",
          muted: "#64748b",
          gold: "#1f1a12",
        },
        accent: {
          primary: "#176b87",
          danger: "#f2d4d0",
          dangerInk: "#8a1f13",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      boxShadow: {
        panel: "0 14px 38px rgba(38, 31, 20, 0.08)",
        popup:
          "0 14px 32px rgba(28, 26, 22, 0.18), 0 2px 6px rgba(28, 26, 22, 0.08)",
      },
    },
  },
  plugins: [],
};
