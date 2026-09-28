import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        compass: {
          bg: "#f4f4f4",
          panel: "#ffffff",
          line: "#DDDDDD",
          accent: "#4DBC65",
          success: "#4DBC65",
          warning: "#F2CD5D",
          error: "#E94F37"
        }
      },
      borderRadius: {
        card: "8px"
      }
    }
  },
  plugins: []
};

export default config;
