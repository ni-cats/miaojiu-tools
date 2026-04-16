import { defineConfig } from 'vite'
import path from 'path'

// 主进程的 Vite 配置
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    outDir: path.resolve(__dirname, 'dist/main'),
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron', 'electron-store', 'cos-nodejs-sdk-v5', 'js-yaml', 'tesseract.js', 'path', 'fs', 'os', 'url', 'child_process', 'http', 'crypto'],
    },
    minify: false,
  },
})
