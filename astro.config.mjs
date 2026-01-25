import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  integrations: [svelte()],
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),

  server: {
    port: 4321,
    host: true
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: true, 
    }
  }
});