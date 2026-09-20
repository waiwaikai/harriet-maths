import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const BUILD_ID = new Date().toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig(({ mode }) => ({
  // GitHub Pages serves from /harriet-maths/; dev stays at root
  base: mode === 'production' ? '/harriet-maths/' : '/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // registered by hand in main.tsx so the app can re-check on resume:
      // an installed iOS PWA is suspended, never reloaded, so the default
      // load-time registration may never run again and the device sticks
      // on an old build forever.
      injectRegister: null,
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Harriet is a Maths Whiz!',
        short_name: 'Maths Whiz',
        description: 'Daily 10-minute morning maths for Harriet',
        theme_color: '#fef6e4',
        background_color: '#fef6e4',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
      },
    }),
  ],
  server: {
    port: 5188,
    host: true,
    // allow access via the cloudflared quick-tunnel hostname
    allowedHosts: ['.trycloudflare.com'],
  },
}));
