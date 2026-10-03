import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 8080, strictPort: true },
  preview: { port: 8080, strictPort: true },
  build: { target: 'esnext' },
  plugins: [
    react(),
    // No remotes are declared here: their URLs come from /config.json at runtime.
    federation({
      name: 'shell',
      dts: false,
      remotes: {},
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
});
