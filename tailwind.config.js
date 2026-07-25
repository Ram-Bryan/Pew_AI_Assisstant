/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#22C55E", // Pew's green
        accent: "#38BDF8", // Pew's light blue
      },
    },
  },
  plugins: [],
};
