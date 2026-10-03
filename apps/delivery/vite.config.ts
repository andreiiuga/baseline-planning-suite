import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base: assets resolve against the remote's own origin, not the host page's.
  base: './',
  server: { port: 8082, strictPort: true, cors: true },
  preview: { port: 8082, strictPort: true, cors: true },
  build: { target: 'esnext' },
  plugins: [
    react(),
    federation({
      name: 'delivery',
      dts: false,
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.tsx',
        './api': './src/exposed/api.ts',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      },
    }),
  ],
});
