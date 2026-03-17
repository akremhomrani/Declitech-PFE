/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#0097B2",
        "primary-dark": "#007A8F",
        "background-light": "#F3F5F7",
        "sidebar-bg": "#F8FAFC",
        "surface": "#FFFFFF",
        "border-light": "#E2E8F0",
        "accent-teal": "#00E0F0",
        "text-main": "#1E293B",
        "text-muted": "#64748B"
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
