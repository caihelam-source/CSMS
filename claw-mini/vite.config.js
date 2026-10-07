import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { fileURLToPath } from 'node:url'

// uni-app alpha 的 vue 自带打了补丁的 @vue/* 子包（含 isInSSRComponentSetup
// 等内部 API），位于 @dcloudio/uni-cli-shared/lib/vapor/@vue/。mp-weixin 构建
// 解析 npm 版 vue@3.5.x 时主入口不 re-export 这些内部 API，导致构建报错，
// 因此 mp 平台把底层 @vue/* 子包 alias 到 uni patched 版。
//
// ⚠️ H5 平台（2026-10-07 实证）：uni-h5.es.js 从 "vue" 主入口 import injectHook
// 等内部 API，且 main.js 引导用的是 uni-h5-vue 自带的打包运行时
// （dist/vue.runtime.esm.js，Vue 3.4.21 uni 补丁版，导出全套内部 API）。
// 若 "vue" 解析到 npm vue@3.5.13→vapor@3.5.14，会出现双 Vue 实例：
// vnode/slots 跨实例传递，任何点击后的状态重渲染都会在 updateSlots 崩溃
// （"Cannot assign to read only property '_'"）。
// 修复：H5 平台把 "vue" 统一指到 uni-h5-vue 的打包运行时（单实例、全导出），
// 编译器对齐其自带 3.4.21（esm-browser 自包含），@vue/shared 共用嵌套版。
const h5VueDist = fileURLToPath(
  new URL('./node_modules/@dcloudio/uni-h5-vue/dist/vue.runtime.esm.js', import.meta.url)
)
const h5NM = fileURLToPath(
  new URL('./node_modules/@dcloudio/uni-h5-vue/node_modules', import.meta.url)
)
const uniVue = fileURLToPath(
  new URL('./node_modules/@dcloudio/uni-cli-shared/lib/vapor/@vue', import.meta.url)
)

// UNI_PLATFORM 由 uni CLI 在加载本配置前注入: 'h5' | 'mp-weixin' | ...
const isH5 = process.env.UNI_PLATFORM === 'h5'

const alias = isH5
  ? {
      vue: h5VueDist,
      '@vue/shared': `${h5NM}/@vue/shared/dist/shared.esm-bundler.js`,
      '@vue/compiler-sfc': `${h5NM}/@vue/compiler-sfc/dist/compiler-sfc.esm-browser.js`,
    }
  : {
      '@vue/runtime-core': `${uniVue}/runtime-core`,
      '@vue/runtime-dom': `${uniVue}/runtime-dom`,
      '@vue/reactivity': `${uniVue}/reactivity`,
      '@vue/shared': `${uniVue}/shared`,
      '@vue/runtime-vapor': `${uniVue}/runtime-vapor`,
    }

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias,
  },
})
