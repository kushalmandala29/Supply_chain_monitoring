/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      colors: {
        jarvis: {
          bg:      "#03060f",
          surface: "rgba(8,16,36,0.72)",
          border:  "rgba(34,211,238,0.14)",
        },
      },
      animation: {
        "pulse-dot":  "pulse-dot 1.8s ease-in-out infinite",
        "slide-up":   "slide-up 0.22s ease-out both",
        "blink":      "blink 1.1s step-end infinite",
        "border-pulse": "border-pulse 3s ease-in-out infinite",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { transform: "scale(1)",   opacity: "1" },
          "50%":       { transform: "scale(1.6)", opacity: "0.5" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "blink": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0" },
        },
        "border-pulse": {
          "0%, 100%": { borderColor: "rgba(34,211,238,0.14)" },
          "50%":      { borderColor: "rgba(34,211,238,0.38)" },
        },
      },
      backdropBlur: {
        glass: "18px",
      },
    },
  },
  plugins: [],
};
