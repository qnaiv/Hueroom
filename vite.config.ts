import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages ではリポジトリ名のサブパスで配信されるため、ビルド時に BASE_PATH（例: /Hueroom/）で指定する
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
