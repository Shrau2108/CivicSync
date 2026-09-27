import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { env } from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const codespaceHost = env.CODESPACE_NAME && env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
  ? `${env.CODESPACE_NAME}-5173.${env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
  : undefined;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: codespaceHost
    ? {
        host: '0.0.0.0',
        allowedHosts: [codespaceHost],
        hmr: {
          host: codespaceHost,
          protocol: 'wss',
          clientPort: 443,
        },
      }
    : undefined,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
