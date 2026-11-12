import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built files work from file:// (Electron) and inside the Android WebView (Capacitor).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
