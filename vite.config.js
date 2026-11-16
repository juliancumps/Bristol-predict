import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const DAY = 24 * 60 * 60

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Offline mode: the app files are saved on the phone, and the last API
    // answers are used when the network is slow or gone.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // keep public/manifest.json
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/images/**', '**/geojson/**', '**/icon-192(old).png'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/about\.html/, /^\/api\//],
        runtimeCaching: [
          {
            // Backend API (Railway): try the network for 4 s, then use the saved answer.
            urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200, maxAgeSeconds: 14 * DAY },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Map shapes, images and the splash picture
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && (url.pathname.startsWith('/geojson/') || url.pathname.startsWith('/images/') || url.pathname.endsWith('.jpg')),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'static-data', expiration: { maxEntries: 60, maxAgeSeconds: 30 * DAY } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 365 * DAY } },
          },
          {
            // Satellite map tiles
            urlPattern: ({ url }) => url.hostname === 'server.arcgisonline.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              // Tiles are opaque answers, which use much browser storage. Keep the count small.
              expiration: { maxEntries: 250, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // windy.com embeds and POST requests are not cached.
        ],
      },
    }),
  ],
})
