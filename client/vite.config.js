import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import checker from 'vite-plugin-checker'

export default defineConfig({
  plugins: [
    react(),
    // 开发期 ESLint 实时检查：浏览器 overlay 直接标红未定义组件/变量等错误
    // build 时不启用（部署构建质量由 push-no-git.cjs 的 ESLint 门禁兜底）
    checker({
      eslint: {
        useFlatConfig: true,
        lintCommand: 'eslint src',
      },
      overlay: { initialIsOpen: false },
      enableBuild: false,
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress canvg core-js external module warnings (jspdf-autotable dependency)
        if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.includes('core-js')) return
        warn(warning)
      }
    }
  }
})
