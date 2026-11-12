import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    environment: 'jsdom',
    setupFiles: './src/tests/setup.js',
    exclude: ['e2e/**', '**/node_modules/**', 'work/**'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (/recharts|d3-|victory|decimal/.test(id)) return 'charts';
          if (/\/react(?:-dom|-router|-router-dom)?\/|\/scheduler\//.test(id)) return 'framework';
          if (/\/zod\/|\/react-hook-form\/|\/@hookform\//.test(id)) return 'forms';
          return 'vendor';
        },
      },
    },
  },
});
