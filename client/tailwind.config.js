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
        // 主蓝阶（Lumina blue，替代旧苹果蓝 #0071e3）
        primary: {
          50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
          400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8', 800: '#1E40AF', 900: '#1E3A8A',
        },
        // 品牌橙（唯一 CTA / 强调），走通道值以支持 alpha 修饰符
        accent: 'rgb(var(--rgb-accent) / <alpha-value>)',
        accentHover: '#F97316',
        // 语义色（值来自 index.css 变量，旧 #0071e3 已改为 37 99 235）
        success: 'rgb(var(--c-success) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        info: 'rgb(var(--c-info) / <alpha-value>)',
        // 中性表面 / 文字 / 发丝边框令牌（主题感知，见 index.css 变量，支持透明度）
        canvas: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        ink: 'rgb(var(--text-1) / <alpha-value>)',
        'ink-2': 'rgb(var(--text-2) / <alpha-value>)',
        'ink-3': 'rgb(var(--text-3) / <alpha-value>)',
        hairline: 'rgb(var(--border) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
      },
      borderRadius: {
        sm: '6px', md: '8px', lg: '12px', xl: '16px', '2xl': '18px', full: '999px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(15,23,42,.06)',
        'md': '0 4px 12px rgba(15,23,42,.08)',
        'lg': '0 12px 32px rgba(15,23,42,.12)',
        'focus': '0 0 0 3px rgba(37,99,235,.35)',
        // 其他页面保留
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        'card-hover': '0 6px 20px rgba(0,0,0,0.06)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', '"PingFang SC"', '"Microsoft YaHei"', '"Hiragino Sans GB"', '"Noto Sans CJK SC"', 'sans-serif'],
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
}
