import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'chess_engine.wasm'],
      manifest: {
        name: 'Chess 3x3 Memory Trainer',
        short_name: 'Chess 3x3',
        description: 'Entrena tu memoria y táctica con Chess 3x3 y Palacio Loci',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/823/823292.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/823/823292.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  base: '/chess3x3/',
})
