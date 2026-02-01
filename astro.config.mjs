import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  integrations: [svelte()],
  output: 'server',
  adapter: cloudflare({
    runtime: {
      mode: 'off'
    },
    routes: {
      extend: {
        exclude: [{ pattern: '/api/*' }]
      }
    }
  }),
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
          secure: false,
        },
      },
    }
  }
});