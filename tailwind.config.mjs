// tailwind.config.mjs
import typography from "@tailwindcss/typography";
import lineClamp from "@tailwindcss/line-clamp";

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aurora: {
          50: "#f2fbf6",
          100: "#e6fff2",
          200: "#bff5d9",
          300: "#8fecb9",
          400: "#49e38b",
          500: "#0f9d58", // primary
          600: "#0b7a43",
          700: "#075b33",
          800: "#054428",
        },
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          300: "#cbd5e1",
          500: "#64748b",
          700: "#334155",
        },
      },
      boxShadow: {
        "aurora-md": "0 6px 30px rgba(15, 157, 88, 0.08)",
      },
      borderRadius: {
        xl: "1rem",
      },
    },
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        lg: "2rem",
        xl: "4rem",
      },
    },
  },
  plugins: [typography, lineClamp],
};

export default config;
