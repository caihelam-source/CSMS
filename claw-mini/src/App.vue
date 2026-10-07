<script>
export default {
  onLaunch() {
    // 登录态由 login 页与每个请求统一处理，无需在此额外逻辑
  },
}
</script>

<style>
/* Lumina 迷你令牌 —— 与 web 端 index.css 同值，全项目动画/颜色/圆角只引用变量 */
page {
  --dur-fast: 150ms;
  --dur-base: 200ms;
  --dur-slow: 300ms;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --blue-600: #2563eb;
  --blue-700: #1d4ed8;
  --ink-900: #0f172a;
  --ink-600: #475569;
  --canvas: #f1f5fb;
  --surface: #ffffff;
  --border: #e2e8f0;
  --amber-text: #b45309;
  --amber-bg: #fffbeb;
  --amber-border: #fde68a;

  background-color: var(--canvas);
  color: var(--ink-900);
  font-size: 28rpx;
}
</style>
