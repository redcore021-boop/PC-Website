import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' keeps every URL relative, so the same build works at
// username.github.io/Repo/vocab/, on Netlify, or on Cloudflare Pages.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Lexicon — אוצר מילים מתקדם באנגלית',
        short_name: 'Lexicon',
        description: 'אוצר מילים מתקדם באנגלית — ללמוד מילים ולהשתמש בהן באמת.',
        lang: 'he',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#101218',
        theme_color: '#101218',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
});
