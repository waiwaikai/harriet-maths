import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  // GitHub Pages serves from /harriet-maths/; dev stays at root
  base: mode === 'production' ? '/harriet-maths/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
