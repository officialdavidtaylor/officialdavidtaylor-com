import defaultTheme from 'tailwindcss/defaultTheme';
import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    fontFamily: {
      // extend existing font utilities
      sans: ['"Atkinson Hyperlegible"', ...defaultTheme.fontFamily.sans],
      serif: ['"Noto Serif"', ...defaultTheme.fontFamily.serif],
      mono: ['"Fira Code"', ...defaultTheme.fontFamily.mono],

      // create new font utilities
      display: [
        'Geologica',
        'ui-sans-serif',
        'system-ui',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
        '"Noto Color Emoji"',
      ],
      'casual-heading': ['"Permanent Marker"'],
    },
  },
  plugins: [typography],
};

export default config;
