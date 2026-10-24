import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        noir: "#0E0912",
        aubergine: {
          50: "#F6F2F9",
          100: "#ECE4F2",
          200: "#D6C7E2",
          300: "#B9A2CF",
          400: "#9177AE",
          500: "#6E4F8C",
          600: "#4E3266",
          700: "#3A2350",
          800: "#26152F",
          850: "#1D1025",
          900: "#160C1C",
          950: "#100915",
        },
        ivory: "#F6F1EA",
        // Herbier
        paper: { DEFAULT: "#f4ead0", deep: "#e9dab6", light: "#faf4e3" },
        ink: { DEFAULT: "#1B1320", soft: "#3B2E41", muted: "#6B5E70", faint: "#9A8F9C" },
        plum: { DEFAULT: "#2A1A33", deep: "#1A1020", night: "#110B15" },
        foil: { DEFAULT: "#D9D0C6", light: "#F1EBE4", deep: "#B9AFA6" },
        bone: "#E3D7C8",
        gold: {
          DEFAULT: "#C6A15B",
          light: "#EAD7A8",
          deep: "#8E6A2E",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        caps: ["var(--font-display)", "Georgia", "serif"],
        text: ["var(--font-text)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "10xl": ["10rem", { lineHeight: "0.85" }],
        "11xl": ["12rem", { lineHeight: "0.82" }],
      },
      letterSpacing: {
        caps: "0.32em",
        wider2: "0.18em",
      },
      transitionTimingFunction: {
        silk: "cubic-bezier(0.22, 1, 0.36, 1)",
        petal: "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 50%" },
          "100%": { backgroundPosition: "-200% 50%" },
        },
        drift: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "900px 900px" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.25", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        shimmer: "shimmer 6s linear infinite",
        drift: "drift 120s linear infinite",
        marquee: "marquee 40s linear infinite",
        twinkle: "twinkle 3.5s ease-in-out infinite",
        floaty: "floaty 6s ease-in-out infinite",
        "spin-slow": "spin-slow 22s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
