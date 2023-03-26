/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#031B4D",
        secondary: "#314670",
        "primary-text": "#081B4B",
        border: "#E0E0E7",
        cancel: "#C62137",
        "bg-light": "#f8f8f9",
        "accent-teal": "#00e16d",
        "accent-cyan": "#00dad6",
        "accent-fucsia": "#fda5fe",
        "accent-orange": "#fdb570",
        "accent-indigo": "#bdbefe",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
