import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" }, screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        // Brand colours sampled from the agency logo (Logo_3.png) and AlterEstate site config.
        brand: { DEFAULT: "#EB6500", 50: "#FFF7ED", 100: "#FFEBD5", 200: "#FFD3A8", 500: "#EB6500", 600: "#C75400", 700: "#A04300" },
        navy: { DEFAULT: "#102632", 50: "#F2F5F7", 100: "#E1E8EC", 200: "#C3D0D8", 400: "#5D7685", 600: "#25404F", 700: "#1A3240", 800: "#102632", 900: "#0A1A23" },
        sand: { DEFAULT: "#FBF8F3", 100: "#F5EFE6", 200: "#EAE0D1" },
        ink: { DEFAULT: "#18212A", muted: "#4B5966", soft: "#6B7782" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,38,50,.06), 0 8px 24px -12px rgba(16,38,50,.18)",
        lift: "0 2px 4px rgba(16,38,50,.06), 0 18px 40px -16px rgba(16,38,50,.28)",
      },
      borderRadius: { xl2: "1.25rem" },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "none" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        kenburns: { "0%": { transform: "scale(1.02) translate3d(0,0,0)" }, "100%": { transform: "scale(1.14) translate3d(-1.5%,-1%,0)" } },
        "word-in": { "0%": { opacity: "0", transform: "translateY(110%) rotate(4deg)" }, "100%": { opacity: "1", transform: "none" } },
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-12px)" } },
        "spin-slow": { "100%": { transform: "rotate(360deg)" } },
        blob: { "0%,100%": { borderRadius: "42% 58% 70% 30% / 45% 45% 55% 55%", transform: "translate(0,0) scale(1)" }, "33%": { borderRadius: "70% 30% 46% 54% / 30% 29% 71% 70%", transform: "translate(4%,-6%) scale(1.06)" }, "66%": { borderRadius: "28% 72% 34% 66% / 58% 37% 63% 42%", transform: "translate(-5%,4%) scale(.95)" } },
        "scroll-dot": { "0%": { transform: "translateY(0)", opacity: "1" }, "80%": { transform: "translateY(14px)", opacity: "0" }, "100%": { opacity: "0" } },
        "pop-in": { "0%": { opacity: "0", transform: "scale(.92) translateY(10px)" }, "100%": { opacity: "1", transform: "none" } },
        "gradient-pan": { "0%,100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
      },
      animation: {
        "fade-up": "fade-up .45s ease-out both",
        shimmer: "shimmer 1.6s infinite",
        kenburns: "kenburns 22s ease-out both alternate infinite",
        "word-in": "word-in .9s cubic-bezier(.2,.7,.1,1) both",
        marquee: "marquee 38s linear infinite",
        float: "float 6s ease-in-out infinite",
        "spin-slow": "spin-slow 26s linear infinite",
        blob: "blob 16s ease-in-out infinite",
        "scroll-dot": "scroll-dot 1.8s ease-in-out infinite",
        "pop-in": "pop-in .7s cubic-bezier(.2,.7,.1,1) both",
        "gradient-pan": "gradient-pan 12s ease infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
