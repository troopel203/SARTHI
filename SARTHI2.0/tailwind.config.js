/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1F2A",
        teal: {
          950: "#062A33",
          900: "#0B5566",
          700: "#106A7E",
          500: "#1B8A9E",
          300: "#6FBAC9",
          100: "#E3F2F5",
        },
        coral: {
          600: "#E85A3B",
          500: "#FF6B4A",
          100: "#FFE7E0",
        },
        amber: {
          600: "#D9890B",
          500: "#F2A93B",
          100: "#FDF0DA",
        },
        mint: {
          600: "#188F5C",
          500: "#22B573",
          100: "#DDF5EA",
        },
        canvas: "#F5F8F7",
        line: "#E3E9E8",
      },
      fontFamily: {
        display: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,31,42,0.04), 0 8px 24px rgba(11,31,42,0.06)",
        pop: "0 12px 32px rgba(11,31,42,0.12)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        slideIn: {
          "0%": { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        pulseRing: "pulseRing 1.8s cubic-bezier(0.4,0,0.6,1) infinite",
        slideIn: "slideIn 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
