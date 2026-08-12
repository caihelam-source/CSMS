import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 客户端组件使用自动 JSX 运行时（react/jsx-runtime）。不引入 @vitejs/plugin-react，
  // 避免其将 esbuild.jsx 改写为 'preserve' 而未被 babel 转换，导致 .jsx 测试报 "React is not defined"。
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
    jsxDev: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
