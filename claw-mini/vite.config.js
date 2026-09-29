import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { fileURLToPath } from 'node:url'

// uni-app 的 vue3 alpha 自带打了补丁的 @vue/* 子包（含 isInSSRComponentSetup
// 等内部 API），位于 @dcloudio/uni-cli-shared/lib/vapor/@vue/。H5 构建默认解析
// npm 版 vue@3.5.x，其主入口不 re-export 这些内部 API，导致构建报错。
//
// 之前把整棵 vue alias 到 uni 自带版能构建通过，但运行时 H5 的标准 Vue3 初始化
// 路径被破坏，出现 "onCreateVueApp 不可用，页面级 mixin 未注入" 警告，页面空白。
//
// 正确做法：只把底层 @vue/* 子包 alias 到 uni patched 版，让 npm vue 的主入口
// 继续负责 H5 初始化；这样 isInSSRComponentSetup 会通过
// vue → @vue/runtime-dom → @vue/runtime-core(aliased) 链路被 Rollup 找到。
const uniVue = fileURLToPath(
  new URL('./node_modules/@dcloudio/uni-cli-shared/lib/vapor/@vue', import.meta.url)
)

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      '@vue/runtime-core': `${uniVue}/runtime-core`,
      '@vue/runtime-dom': `${uniVue}/runtime-dom`,
      '@vue/reactivity': `${uniVue}/reactivity`,
      '@vue/shared': `${uniVue}/shared`,
      '@vue/runtime-vapor': `${uniVue}/runtime-vapor`,
    },
  },
})
