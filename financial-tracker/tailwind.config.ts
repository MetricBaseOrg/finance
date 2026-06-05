import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        black: "var(--color-black)",
        "bg-elev": "var(--color-bg-elev)",
        "bg-card": "var(--color-bg-card)",
        "bg-hover": "var(--color-bg-hover)",
        gold: "var(--color-gold)",
        "gold-bright": "var(--color-gold-bright)",
        "gold-dim": "var(--color-gold-dim)",
        white: "var(--color-white)",
        "gray-1": "var(--color-gray-1)",
        "gray-2": "var(--color-gray-2)",
        "gray-3": "var(--color-gray-3)",
        "gray-4": "var(--color-gray-4)",
        line: "var(--color-line)",
        "line-strong": "var(--color-line-strong)",
        up: "var(--color-up)",
        down: "var(--color-down)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        xs: "0",
        sm: "0",
        md: "0",
        lg: "0",
        xl: "0",
        "2xl": "0",
        "3xl": "0",
      },
    },
  },
  plugins: [],
};

export default config;
