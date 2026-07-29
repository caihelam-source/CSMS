/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  // 暗色模式走 class 策略（在 <html> 上加 .dark 即启用，令牌已就绪）
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 单一强调色：Apple 系统蓝（500=#0a84ff 亮 / 600=#0071e3 主）
        primary: {
          50:  '#eef6ff',
          100: '#d9ecff',
          200: '#b6d8ff',
          300: '#84bcff',
          400: '#3f97ff',
          500: '#0a84ff',
          600: '#0071e3',
          700: '#005bbd',
          800: '#004a9c',
          900: '#0a3d7a',
        },
        // 语义色（仅承载状态；值来自 CSS 变量，支持透明度修饰符，暗色自动切换）
        success: 'rgb(var(--c-success) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        danger:  'rgb(var(--c-danger) / <alpha-value>)',
        info:    'rgb(var(--c-info) / <alpha-value>)',
        // 中性表面/文字/发丝边框令牌（主题感知，见 index.css 变量，支持透明度）
        canvas:   'rgb(var(--bg) / <alpha-value>)',
        surface:  'rgb(var(--surface) / <alpha-value>)',
        ink:      'rgb(var(--text-1) / <alpha-value>)',
        'ink-2':  'rgb(var(--text-2) / <alpha-value>)',
        'ink-3':  'rgb(var(--text-3) / <alpha-value>)',
        hairline: 'rgb(var(--border) / <alpha-value>)',
      },
      borderRadius: {
        xl: '0.875rem',   // 14px
        '2xl': '1.125rem', // 18px（卡片用，Apple 风）
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        'card-hover': '0 6px 20px rgba(0,0,0,0.06)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
}
