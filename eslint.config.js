const js = require('@eslint/js')
const globals = require('globals')
const react = require('eslint-plugin-react')

module.exports = [
  {
    // dist* 通配可覆盖构建产物及其历史备份目录（dist、dist.bak.*、dist_prev_* 等），
    // 这些目录只含压缩产物，既不该被 lint，也可能因权限问题无法被遍历。
    ignores: ['**/node_modules/', '**/dist*/', '**/build/', '**/.workbuddy/', '**/client/tmp/'],
  },
  // ── 后端（Node / CommonJS）──
  {
    files: ['server/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  // ── 前端（React / ESM / JSX）──
  {
    files: ['client/src/**/*.{js,jsx}'],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      'react/jsx-uses-vars': 'error',
      // 拦截未 import 的 JSX 组件（如 <Power/> 漏 import → 运行时 ReferenceError）。
      // 核心 no-undef 对 JSX 标识符不生效，必须靠这条；vite build 同样不检测。
      // 2026-09-10 上线事故（ComplianceRules 'Power is not defined'）后补上，全量 fallout = 0。
      'react/jsx-no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
    },
  },
]
