import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 将React相关库打包到一个文件中
          'react-vendor': ['react', 'react-dom'],
          // 将Ant Design相关库打包到一个文件中
          'antd-vendor': ['antd'],
        }
      }
    },
    // 调整警告限制（可选）
    chunkSizeWarningLimit: 800,
  }
})
