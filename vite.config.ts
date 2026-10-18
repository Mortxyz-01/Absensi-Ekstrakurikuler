import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Security headers applied by the dev server and `vite preview`.
// On production hosting, replicate these at the reverse proxy / edge config.
const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
});
