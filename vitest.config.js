// 仓库根级 vitest 配置：供 `npm run test:client`（从仓库根目录调用）使用。
//
// 注意：本仓库 vitest 安装在 client/node_modules，根目录无法直接 require('vitest/config')，
// 故此处用「纯对象默认导出」（vitest 支持），避免模块解析失败。
//
// 关键：开启自动 JSX 运行时（react/jsx-runtime），否则 .jsx 组件测试会报 "React is not defined"。
// 语义与 client/vitest.config.js 保持一致；从 client 目录运行时由 client/vitest.config.js 接管。
export default {
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
    jsxDev: false,
  },
  test: {
    environment: 'node',
    include: ['client/src/**/*.test.{js,jsx}'],
  },
}
