/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#f97316",
          50:  "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        dark: {
          50:  "#1a1a2e",
          100: "#16213e",
          200: "#0f3460",
          300: "#111827",
          400: "#0d0d0d",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in":    "fadeIn 0.5s ease-in-out",
        "slide-up":   "slideUp 0.4s ease-out",
        "slide-down": "slideDown 0.4s ease-out",
        "scale-in":   "scaleIn 0.3s ease-out",
        "bounce-in":  "bounceIn 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)",
        "spin-slow":  "spin 3s linear infinite",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "float":      "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:   { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:  { "0%": { transform: "translateY(20px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        slideDown:{ "0%": { transform: "translateY(-20px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        scaleIn:  { "0%": { transform: "scale(0.9)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        bounceIn: { "0%, 100%": { transform: "scale(1)" }, "50%": { transform: "scale(1.05)" } },
        float:    { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
      },
      backdropBlur: { xs: "2px" },
      boxShadow: {
        glow:     "0 0 20px rgba(249, 115, 22, 0.3)",
        "glow-lg":"0 0 40px rgba(249, 115, 22, 0.4)",
        "card":   "0 4px 24px rgba(0,0,0,0.4)",
        "card-lg":"0 8px 40px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};
