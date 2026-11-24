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
      },
      animation: { "fade-up": "fade-up .45s ease-out both", shimmer: "shimmer 1.6s infinite" },
    },
  },
  plugins: [],
} satisfies Config;
