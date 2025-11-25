import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // 允许外部访问
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000', // 使用IPv4地址，避免IPv6连接问题
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api') // 保持路径不变
      }
    }
  }
})

