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
        
        // Brand Login Colors
        'brand-dark': '#0a0a1f',
        'brand-accent': '#ff0080',
        'brand-blue': '#4a6cf7',
        'brand-purple': '#9333ea',
        
        // CRM Panel Colors
        "crm-surface-container-lowest": "#ffffff",
        "inverse-primary": "#bfc2ff",
        "on-primary-container": "#777eea",
        "secondary-fixed-dim": "#c1c3f3",
        "on-primary-fixed-variant": "#3239a3",
        "background": "#f8f9fa",
        "on-primary": "#ffffff",
        "inverse-surface": "#2e3132",
        "outline-variant": "#c6c5d5",
        "on-surface": "#191c1d",
        "on-surface-variant": "#464653",
        "primary-fixed-dim": "#bfc2ff",
        "error-container": "#ffdad6",
        "crm-surface-container-low": "#f3f4f5",
        "on-primary-fixed": "#00006e",
        "tertiary-container": "#4d0000",
        "secondary-container": "#cccefe",
        "on-tertiary": "#ffffff",
        "inverse-on-surface": "#f0f1f2",
        "tertiary-fixed": "#ffdad4",
        "primary": "#00003c",
        "secondary-fixed": "#e0e0ff",
        "crm-surface-container-highest": "#e1e3e4",
        "on-secondary-container": "#545680",
        "on-background": "#191c1d",
        "on-secondary-fixed": "#15173d",
        "surface-tint": "#4b53bc",
        "on-secondary-fixed-variant": "#41436c",
        "on-tertiary-container": "#d96756",
        "error": "#ba1a1a",
        "on-secondary": "#ffffff",
        "tertiary-fixed-dim": "#ffb4a8",
        "surface-bright": "#f8f9fa",
        "outline": "#767684",
        "surface-variant": "#e1e3e4",
        "secondary": "#585b85",
        "crm-surface-container-high": "#e7e8e9",
        "on-tertiary-fixed-variant": "#82271c",
        "on-error": "#ffffff",
        "crm-surface": "#f8f9fa",
        "on-tertiary-fixed": "#410000",
        "on-error-container": "#93000a",
        "crm-surface-container": "#edeeef",
        "primary-fixed": "#e0e0ff",
        "tertiary": "#220000",
        "primary-container": "#000080",
        "surface-dim": "#d9dadb"
      },
      fontFamily: {
        'space-grotesk': ['Space_Grotesk', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
        'headline': ['Manrope', 'sans-serif'],
        'body': ['Inter', 'sans-serif'],
        'label': ['Inter', 'sans-serif']
      },
      animation: {
        'border-beam': 'border-beam calc(var(--duration)*1s) infinite linear',
      },
      keyframes: {
        'border-beam': {
          '100%': { 'offset-distance': '100%' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
