/**
 * TemplateFill 组件测试（vitest，node 环境，react-dom/server 渲染）。
 *
 * 覆盖：
 *   - 「复制 HTML」按钮存在（任何可填写角色可见）。
 *   - 当模板 variables 含 source:'director' / source:'meeting' 时，对应选择器可见。
 *   - 当模板 variables 不含上述 source 时，对应选择器不渲染。
 *
 * 说明：客户端测试环境为 node + 未安装 @testing-library，故用 renderToString 做服务端渲染断言。
 */
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'

const { tpl, plainTpl } = vi.hoisted(() => {
  const docSchema = {
    schemaVersion: 1,
    layoutMode: 'custom',
    meta: { docTitle: '测试' },
    fields: [
      { key: 'companyName', label: '公司', type: 'text', source: 'company', fieldPath: 'name' },
      { key: 'board', label: '董事', type: 'text', source: 'director', fieldPath: 'boardList' },
      { key: 'mdate', label: '会议日期', type: 'text', source: 'meeting', fieldPath: 'meeting.date' },
    ],
    rules: [],
    layout: { sections: [{ type: 'paragraph', segments: [{ var: 'companyName', blank: '＿＿＿＿' }] }] },
  }
  const tpl = {
    _id: 't1',
    name: '测试模板',
    docSchema,
    variables: [
      { key: 'companyName', source: 'company', fieldPath: 'name' },
      { key: 'board', source: 'director', fieldPath: 'boardList' },
      { key: 'mdate', source: 'meeting', fieldPath: 'meeting.date' },
    ],
  }
  const plainTpl = {
    _id: 't2',
    name: '纯公司模板',
    docSchema,
    variables: [{ key: 'companyName', source: 'company', fieldPath: 'name' }],
  }
  return { tpl, plainTpl }
})

// 真实服务层依赖 axios / 大量 mock 数据，此处整体 mock，避免拉起网络与重依赖。
vi.mock('../../services/index.js', () => {
  const ok = async () => ({ data: { data: tpl } })
  return {
    templateService: {
      getOne: ok,
      resolve: async () => ({ data: { data: { values: {}, autoFilled: [] } } }),
    },
    companyService: { getAll: async () => ({ data: { data: [] } }) },
    personnelService: { getAll: async () => ({ data: { data: [] } }) },
    meetingService: { getAll: async () => ({ data: { data: [] } }) },
  }
})

import TemplateFill from './TemplateFill'

describe('TemplateFill', () => {
  it('始终渲染「复制 HTML」按钮（不受角色限制）', () => {
    const html = renderToString(React.createElement(TemplateFill, { template: tpl }))
    expect(html).toContain('复制 HTML')
  })

  it('模板 variables 含 director/meeting source 时显示董事 / 会议选择器', () => {
    const html = renderToString(React.createElement(TemplateFill, { template: tpl }))
    expect(html).toContain('选择董事')
    expect(html).toContain('选择会议')
  })

  it('模板 variables 不含 director/meeting source 时隐藏对应选择器', () => {
    const html = renderToString(React.createElement(TemplateFill, { template: plainTpl }))
    expect(html).not.toContain('选择董事')
    expect(html).not.toContain('选择会议')
  })
})
