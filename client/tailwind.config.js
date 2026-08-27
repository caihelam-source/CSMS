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
        // 品牌深蓝锚点（印章环 / 反白底 / 权威感来源）
        navy: 'rgb(var(--brand-navy) / <alpha-value>)',
        ink: 'rgb(var(--text-1) / <alpha-value>)',
        'ink-2': 'rgb(var(--text-2) / <alpha-value>)',
        'ink-3': 'rgb(var(--text-3) / <alpha-value>)',
        'ink-brand': 'rgb(var(--ink-brand) / <alpha-value>)',
        hairline: 'rgb(var(--border) / <alpha-value>)',
        'line-strong': 'rgb(var(--border-strong) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        paper: 'rgb(var(--bg) / <alpha-value>)',
        // 数据可视化 6 色板（图表 / 状态点 / 图例统一来源；含 brand blue）
        data: {
          1: 'rgb(var(--data-1) / <alpha-value>)',
          2: 'rgb(var(--data-2) / <alpha-value>)',
          3: 'rgb(var(--data-3) / <alpha-value>)',
          4: 'rgb(var(--data-4) / <alpha-value>)',
          5: 'rgb(var(--data-5) / <alpha-value>)',
          6: 'rgb(var(--data-6) / <alpha-value>)',
        },
      },
      borderRadius: {
        xs: '6px', sm: '10px', md: '14px', lg: '18px', xl: '24px', '2xl': '28px', '3xl': '32px', full: '999px',
      },
      boxShadow: {
        // 柔化阴影 s-1~s-4（Batch 04 设计语言）：引用 index.css 变量，明暗自动切换
        '1': 'var(--s-1)', '2': 'var(--s-2)', '3': 'var(--s-3)', '4': 'var(--s-4)',
        'sm': 'var(--s-1)', 'md': 'var(--s-2)', 'lg': 'var(--s-4)',
        'focus': '0 0 0 3px rgba(37,99,235,.18)',
        // 其他页面保留
        'card': 'var(--s-1)', 'card-hover': 'var(--s-2)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', '"PingFang SC"', '"Microsoft YaHei"', '"Hiragino Sans GB"', '"Noto Sans CJK SC"', 'sans-serif'],
      },
      // 间距令牌显式化：单一事实源为 index.css 的 --space-*（补齐 9/11/14/16）
      // 编辑 CSS 变量即全局生效；p-4 / gap-6 等工具类自动走令牌，杜绝硬编码像素
      spacing: {
        '1': 'var(--space-1)', '2': 'var(--space-2)', '3': 'var(--space-3)', '4': 'var(--space-4)',
        '5': 'var(--space-5)', '6': 'var(--space-6)', '7': 'var(--space-7)', '8': 'var(--space-8)',
        '9': 'var(--space-9)', '10': 'var(--space-10)', '11': 'var(--space-11)', '12': 'var(--space-12)',
        '14': 'var(--space-14)', '16': 'var(--space-16)',
      },
      transitionDuration: {
        DEFAULT: '150ms', fast: '150ms', base: '200ms', slow: '300ms',
      },
      // 字号阶梯：对齐设计稿规范 12/14/15/17/22/32/46（Batch 03 字体校准）
      // 默认工具类直接映射到规范字阶，全站 text-* 即按 token 校准；
      // 缺的中间阶以具名工具补充（text-13 等），杜绝散落 px。
      fontSize: {
        xs: 'var(--ts-12)',     // 12px  caption / 微标签
        sm: 'var(--ts-14)',     // 14px  次要正文
        base: 'var(--ts-15)',   // 15px  正文基准（替代旧 16px）
        lg: 'var(--ts-17)',     // 17px  lead
        xl: 'var(--ts-22)',     // 22px  区块标题
        '2xl': 'var(--ts-32)',  // 32px  页面标题 ch2
        '3xl': 'var(--ts-46)',  // 46px  hero 标题 ch1
        '13': 'var(--ts-13)',   // 13px  小标签
      },
    },
  },
  plugins: [],
}
