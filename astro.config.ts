// @ts-check
import { defineConfig, memoryCache } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  adapter: node({ mode: 'standalone' }),
  experimental: {
    cache: {
      provider: memoryCache(),
    },
  },
  vite: {
    server: {
      allowedHosts: ['web'],
    },
    plugins: [tailwindcss()],
  },
});
