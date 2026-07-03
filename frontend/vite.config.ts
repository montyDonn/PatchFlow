import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (command === 'build') {
    if (!env.VITE_API_URL || env.VITE_API_URL.trim() === '') {
      throw new Error(
        '\n======================================================================\n' +
        'FATAL BUILD ERROR: VITE_API_URL is missing!\n' +
        'For production builds, you must define VITE_API_URL.\n' +
        'Example: VITE_API_URL=https://server.domain/patchflow-api-1.0.0/api npm run build\n' +
        '======================================================================\n'
      );
    }
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: 5173,
      strictPort: true,
    },
  }
})
