import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages sirve el sitio en https://usuario.github.io/nombre-repo/,
  // no en la raíz del dominio. El workflow de deploy (.github/workflows/
  // frontend-deploy.yml) setea BASE_PATH=/nombre-repo/ automáticamente
  // usando el nombre real del repo. En desarrollo local (sin esa variable)
  // se sirve en la raíz como siempre.
  base: process.env.BASE_PATH || '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
})
