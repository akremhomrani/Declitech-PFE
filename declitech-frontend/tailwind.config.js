/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "primary": "#0097B2",
        "primary-dark": "#007A8F",
        // Semantic tokens — driven by CSS variables so they auto-switch in dark mode
        "background-light": "rgb(var(--color-bg) / <alpha-value>)",
        "sidebar-bg":       "rgb(var(--color-sidebar) / <alpha-value>)",
        "surface":          "rgb(var(--color-surface) / <alpha-value>)",
        "border-light":     "rgb(var(--color-border) / <alpha-value>)",
        "text-main":        "rgb(var(--color-text-main) / <alpha-value>)",
        "text-muted":       "rgb(var(--color-text-muted) / <alpha-value>)",
        "accent-teal": "#00E0F0",
      },
      fontFamily: {
        "sans": ["Plus Jakarta Sans", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.375rem",
        "lg": "0.625rem",
        "xl": "1rem",
        "full": "9999px"
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
