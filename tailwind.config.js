/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#22C55E", // Pew's green
        accent: "#38BDF8", // Pew's light blue
        background: "#FFFFFF",
        surface: "#F8FAFC",
        border: "#E2E8F0",
        "text-primary": "#0F172A",
        "text-secondary": "#64748B",
        success: "#22C55E",
        warning: "#F59E0B",
        error: "#EF4444",
        disabled: "#CBD5E1"
      }
    },
  },
  plugins: [],
};
