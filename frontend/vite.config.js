import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    // request /api/... diteruskan ke Laravel (php artisan serve) -> tidak perlu atur CORS
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
