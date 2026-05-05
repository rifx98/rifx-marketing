import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'space-navy': '#0B1D33',
        'rocket-orange': '#F27121',
        'card-dark': '#161e3d',
        'rocket-hover': '#D35400',
        'surface': '#0b1229',
        'surface-container': '#181e36',
        'surface-container-low': '#141a32',
        'surface-container-highest': '#2d344c',
      },
      fontFamily: {
        'space-grotesk': ['Space_Grotesk', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
