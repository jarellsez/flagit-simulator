import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        // Website entry
        main: resolve(__dirname, 'index.html'),
        // Extension popup entry
        popup: resolve(__dirname, 'popup.html'),
        // Content script (this was missing!)
        content: resolve(__dirname, 'src/content/content.js')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
})