/**
 * renderEntry.jsx — 静态预览打包入口（仅供 scripts/renderPresets.cjs 使用）。
 *
 * 本文件不属于产品代码，不被前端或后端引用。它只负责把
 * 「React 运行时 + SchemaDocRenderer + 9 个合规文档预设」聚合成
 * 一个可被 esbuild 打成 CJS 的模块图，供 Node 端做 SSR 静态渲染。
 *
 * 约束：
 *   - 不修改任何 preset / 引擎 / 前端组件，只做只读导入。
 *   - 预设为 CommonJS（module.exports = {...}），经 esbuild 互操作后
 *     默认导入即拿到整个导出对象。
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import SchemaDocRenderer from '../client/src/schemaDoc/SchemaDocRenderer.jsx'

import directorConfirmation from '../server/data/presets/directorConfirmation.js'
import du004gUndertaking from '../server/data/presets/du004gUndertaking.js'
import departmentSelfAssessment from '../server/data/presets/departmentSelfAssessment.js'
import internalControlReport from '../server/data/presets/internalControlReport.js'
import boardResolution from '../server/data/presets/boardResolution.js'
import projectCharter from '../server/data/presets/projectCharter.js'
import directorResignation from '../server/data/presets/directorResignation.js'
import directorConsentToAct from '../server/data/presets/directorConsentToAct.js'
import directorCodeComplianceConfirmation from '../server/data/presets/directorCodeComplianceConfirmation.js'

/**
 * 原始预设列表，顺序即生成顺序。
 * @type {Array<object>}
 */
const RAW_PRESETS = [
  directorConfirmation,
  du004gUndertaking,
  departmentSelfAssessment,
  internalControlReport,
  boardResolution,
  projectCharter,
  directorResignation,
  directorConsentToAct,
  directorCodeComplianceConfirmation,
]

/**
 * 兼容 CJS/ESM 互操作：优先取 module.exports 本体，其次取 .default。
 * @param {object} mod 导入结果
 * @returns {object} 预设对象
 */
function unwrap(mod) {
  if (mod && typeof mod === 'object' && !mod.presetKey && mod.default) {
    return mod.default
  }
  return mod || {}
}

/**
 * 归一化后的预设数组，每项形如 { key, docSchema, sampleData }。
 * 只透传预设自带的 sampleData，不注入任何额外数据。
 * @type {Array<{key: string, docSchema: object, sampleData: object}>}
 */
export const presets = RAW_PRESETS.map((raw) => {
  const preset = unwrap(raw)
  return {
    key: preset.presetKey || 'unknown-preset',
    docSchema: preset.docSchema || {},
    sampleData: preset.sampleData || {},
  }
})

export { React, renderToStaticMarkup, SchemaDocRenderer }
