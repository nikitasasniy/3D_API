import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/nodes': 'http://127.0.0.1:8000', // Прокси для запросов к серверу FastAPI
    },
  },
});
