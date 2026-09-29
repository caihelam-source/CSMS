import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { fileURLToPath } from 'node:url'

// uni-app 的 vue3 alpha 自带打了补丁的 vue（含 isInSSRComponentSetup 等内部导出），
// 位于 @dcloudio/uni-cli-shared/lib/vapor/@vue/。H5 入口默认会解析到 npm 安装的
// vue@3.5.x（主入口不 re-export 这些内部 API），导致构建报
// "isInSSRComponentSetup is not exported by vue"。这里把 vue / @vue/* 强制 alias 到
// uni 自带的 patched 版本，与 mp-weixin 构建隐含使用的 vue 保持一致。
const uniVue = fileURLToPath(
  new URL('./node_modules/@dcloudio/uni-cli-shared/lib/vapor/@vue', import.meta.url)
)

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      vue: `${uniVue}/vue`,
      '@vue/runtime-core': `${uniVue}/runtime-core`,
      '@vue/runtime-dom': `${uniVue}/runtime-dom`,
      '@vue/reactivity': `${uniVue}/reactivity`,
      '@vue/runtime-vapor': `${uniVue}/runtime-vapor`,
      '@vue/shared': `${uniVue}/shared`,
      '@vue/compiler-dom': `${uniVue}/compiler-dom`,
      '@vue/compiler-core': `${uniVue}/compiler-core`,
      '@vue/compiler-sfc': `${uniVue}/compiler-sfc`,
    },
  },
})
