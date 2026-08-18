import { useEffect, useRef, useState } from 'react'
import { List, Grid, useDynamicRowHeight } from 'react-window'

/**
 * VirtualList — 大列表虚拟化统一入口（C1）
 *
 * 封装 react-window v2（@2.2.7）的 List / Grid，按 mode 切换：
 *  - mode="list"：单列纵向列表（Tasks / Personnel），使用「动态行高」
 *    （useDynamicRowHeight）。动态行高会让 react-window 不强制 height，
 *    由行组件按自身内容自然撑开并被观测，因此可无缝兼容高度不固定的卡片
 *    （如 Tasks 行含/不含描述、按钮），做到与全量渲染「视觉等价、零裁剪」。
 *  - mode="grid"：卡片网格（Companies），使用「固定行高 + 容器宽度测量」，
 *    按断点推算列数（1 / 2 / 3），与原有 grid-cols-1 md:grid-cols-2
 *    lg:grid-cols-3 视觉等价。
 *
 * 设计红线（见 design-p0p1 §4.3 / §7）：
 *  - 行组件必须用 React.memo 包裹（调用方保证：TaskRow/PersonRow/CompanyCard 已是 memo）。
 *  - 父级传给行组件的回调（onEdit/onDelete 等）须 useCallback 记忆化，
 *    数据项经 itemProps 稳定下传，避免行组件无谓重渲染。
 *  - 本组件仅做「可视区渲染」，不改变取数逻辑（前端仍全量取数）。
 *
 * 约定：
 *  - itemKey：行组件接收「当前数据项」所用的 prop 名（'task' | 'person' | 'company'）。
 *  - itemProps：下传给每个行组件的「统一额外 props」（回调 / 派生数据等），须保持稳定引用。
 *  - 行组件必须接收并把自己的根元素挂上 `style`（react-window 注入的绝对定位样式）。
 *    Companies 网格模式下外层 Cell 已负责定位，CompanyCard 仅需 w-full h-full 填满即可。
 */

// 网格断点（与 Tailwind md=768 / lg=1024 对齐）
function columnsForWidth(width, maxColumns) {
  if (width <= 0) return 1
  if (width < 768) return 1
  if (width < 1024) return Math.min(2, maxColumns)
  return maxColumns
}

// ---- list 模式内部行渲染器：接收 react-window 注入的 index/style，透传 items/行组件/额外 props ----
function ListRow({ index, style, items, RowComponent, itemKey, itemProps }) {
  const item = items[index]
  if (!item) return null
  return <RowComponent {...itemProps} {...{ [itemKey]: item }} style={style} />
}

// ---- grid 模式内部单元格渲染器：Cell 外层负责绝对定位 + 间距，内层渲染行组件 ----
function GridCell({ columnIndex, rowIndex, style, items, columnCount, RowComponent, itemKey, itemProps, gap }) {
  const index = rowIndex * columnCount + columnIndex
  const item = items[index]
  if (!item) return null
  return (
    <div style={{ ...style, paddingRight: gap, paddingBottom: gap }}>
      <RowComponent {...itemProps} {...{ [itemKey]: item }} />
    </div>
  )
}

/**
 * @param {object} props
 * @param {'list'|'grid'} [props.mode='list']
 * @param {Array} props.items                全量数据数组
 * @param {React.Component} props.rowComponent  memo 行组件（TaskRow / PersonRow / CompanyCard）
 * @param {number} [props.rowHeight=64]       list=动态行高初始估计；grid=卡片视觉高度（不含 gap）
 * @param {string} [props.itemKey='item']     行组件接收数据项的 prop 名
 * @param {object} [props.itemProps={}]       下传给每个行组件的额外 props（回调/派生数据）
 * @param {number} [props.columns=3]          grid 模式最大列数（按断点推算，取 min(断点列数, columns)）
 * @param {number} [props.gap=16]             grid 模式卡片间距（px）
 * @param {string} [props.className]          外层容器 className
 */
export default function VirtualList({
  mode = 'list',
  items = [],
  rowComponent: RowComponent,
  rowHeight = 64,
  itemKey = 'item',
  itemProps = {},
  columns = 3,
  gap = 16,
  className = '',
}) {
  const containerRef = useRef(null)
  const [width, setWidth] = useState(0)

  // 测量容器宽度（grid 模式需要显式像素宽度）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const measure = () => setWidth(el.clientWidth)
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  if (mode === 'grid') {
    const columnCount = columnsForWidth(width, columns)
    const columnWidth = width > 0 ? Math.floor(width / columnCount) : 0
    const rowCount = Math.ceil(items.length / columnCount)
    const cellRowHeight = rowHeight + gap
    const totalHeight = rowCount * cellRowHeight

    // 宽度尚未测得时，仅渲染测量容器，待 ResizeObserver 回填后渲染 Grid
    if (width === 0) {
      return <div ref={containerRef} className={className} style={{ width: '100%' }} />
    }

    return (
      <div ref={containerRef} className={className} style={{ width: '100%' }}>
        <Grid
          columnCount={columnCount}
          columnWidth={columnWidth}
          rowCount={rowCount}
          rowHeight={cellRowHeight}
          cellComponent={GridCell}
          cellProps={{ items, columnCount, RowComponent, itemKey, itemProps, gap }}
          style={{ height: totalHeight, width: '100%' }}
        />
      </div>
    )
  }

  // ---- list 模式：动态行高，整列表自然高度（与全量渲染等价，无内部滚动条）----
  const dynamicRowHeight = useDynamicRowHeight({ defaultRowHeight: rowHeight })

  return (
    <div ref={containerRef} className={className} style={{ width: '100%' }}>
      <List
        rowCount={items.length}
        rowHeight={dynamicRowHeight}
        rowComponent={ListRow}
        rowProps={{ items, RowComponent, itemKey, itemProps }}
        style={{ width: '100%' }}
      />
    </div>
  )
}
