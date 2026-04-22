/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg: "#0a0a0f",
        surface: "#141420",
        "surface-hover": "#1c1c2e",
        border: "#2a2a3d",
        accent: "#5b4fc4",
        "accent-light": "#8b7fd4",
        neutral: "#22c55e",
        mild: "#d97706",
        stressed: "#dc2626",
        muted: "#6b7280",
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(91, 79, 196, 0.08)',
        glow: '0 0 20px rgba(91, 79, 196, 0.15)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
