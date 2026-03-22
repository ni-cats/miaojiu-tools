import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 渲染进程的 Vite 配置
export default defineConfig({
  plugins: [react()],
  base: './',
  root: path.resolve(__dirname, 'src/renderer'),
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },
})
