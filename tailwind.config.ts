import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#c9a84c",
          light: "#e4c97a",
          dark: "#a07830",
        },
        crimson: {
          DEFAULT: "#8b0000",
          light: "#b22222",
          dark: "#5c0000",
        },
        mystic: {
          DEFAULT: "#0a0a0a",
          surface: "#111111",
          card: "#1a1a1a",
          border: "#2a2a2a",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Palatino Linotype", "Times New Roman", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "mystic-gradient":
          "radial-gradient(ellipse at top, #1a0a2e 0%, #0a0a0a 60%)",
        "gold-gradient": "linear-gradient(135deg, #c9a84c 0%, #e4c97a 100%)",
        "card-gradient":
          "linear-gradient(145deg, #1a1a1a 0%, #111111 50%, #0a0a0a 100%)",
      },
      boxShadow: {
        gold: "0 0 20px rgba(201, 168, 76, 0.3)",
        "gold-lg": "0 0 40px rgba(201, 168, 76, 0.4)",
        crimson: "0 0 20px rgba(139, 0, 0, 0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-in-out",
        shimmer: "shimmer 2s linear infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
