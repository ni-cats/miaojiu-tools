import { defineConfig } from 'vite'
import path from 'path'

// preload 脚本的 Vite 配置
export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/preload/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    outDir: path.resolve(__dirname, 'dist/preload'),
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron'],
    },
    minify: false,
  },
})
