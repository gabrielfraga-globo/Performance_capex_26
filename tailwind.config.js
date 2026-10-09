/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--c-bg)",
        card: { DEFAULT: "var(--c-card)", alt: "var(--c-card-alt)" },
        line: { DEFAULT: "var(--c-line)", soft: "var(--c-line-soft)" },
        ink: { DEFAULT: "var(--c-ink)", muted: "var(--c-ink-muted)", faint: "var(--c-ink-faint)" },
        info: { DEFAULT: "var(--c-info)", soft: "var(--c-info-soft)" },
        warn: { DEFAULT: "var(--c-warn)", soft: "var(--c-warn-soft)" },
        crit: { DEFAULT: "var(--c-crit)", soft: "var(--c-crit-soft)" },
        ok: { DEFAULT: "var(--c-ok)", soft: "var(--c-ok-soft)" },
        hyp: { DEFAULT: "var(--c-hyp)", soft: "var(--c-hyp-soft)" },
      },
      borderRadius: { card: "14px" },
      fontFamily: { sans: ['"Segoe UI"', "Inter", "system-ui", "sans-serif"] },
      boxShadow: { card: "var(--shadow)" },
    },
  },
  plugins: [],
};
