import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // mapbox-gl (~1.9 MB) is its own chunk, loaded only when an address map opens.
  build: { chunkSizeWarningLimit: 2000 },
  test: { include: ['src/**/*.test.{js,jsx}'] },
})
