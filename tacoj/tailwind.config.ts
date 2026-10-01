import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        chili: { DEFAULT: "#D42A1E", deep: "#A5170E", light: "#F0503F" },
        char: { DEFAULT: "#1B1614", 2: "#251E1B", 3: "#342A26" },
        cream: { DEFAULT: "#F7EBD5", 2: "#EEDCBB", 3: "#E2C995" },
        mango: { DEFAULT: "#FFC233", deep: "#F2A900" },
        sunset: { DEFAULT: "#FF6B2C", deep: "#E2501A" },
        ocean: { DEFAULT: "#0E8A8C", deep: "#0A5D63", glow: "#3FE0D0" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        hand: ["var(--font-hand)", "cursive"],
      },
      boxShadow: {
        sticker: "4px 4px 0 0 #1B1614",
        "sticker-lg": "8px 8px 0 0 #1B1614",
        neon: "0 0 0 1px rgba(240,80,63,.6), 0 0 24px rgba(240,80,63,.45), 0 0 64px rgba(240,80,63,.25)",
        "neon-teal": "0 0 0 1px rgba(63,224,208,.5), 0 0 24px rgba(63,224,208,.35)",
      },
      keyframes: {
        flicker: {
          "0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%": { opacity: "1" },
          "20%, 24%, 55%": { opacity: "0.55" },
        },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        floaty: { "0%,100%": { transform: "translateY(0) rotate(var(--r,0deg))" }, "50%": { transform: "translateY(-8px) rotate(var(--r,0deg))" } },
      },
      animation: {
        flicker: "flicker 6s linear infinite",
        marquee: "marquee 38s linear infinite",
        floaty: "floaty 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
