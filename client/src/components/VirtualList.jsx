import { useCallback } from 'react'
import { List } from 'react-window'

/**
 * VirtualList — thin wrapper over react-window's List
 * Renders only visible rows for large datasets.
 *
 * @param {Array} items — full data array
 * @param {number} itemHeight — row height in px
 * @param {Function} renderItem — (item, index, style) => ReactNode
 * @param {number} [maxHeight=600] — max list container height
 * @param {string} [className] — extra class on outer container
 */
export const VirtualList = ({ items, itemHeight = 80, renderItem, maxHeight = 600, className = '' }) => {
  const Row = useCallback(({ index, style }) => renderItem(items[index], index, style), [items, renderItem])

  const height = Math.min(items.length * itemHeight, maxHeight)

  if (items.length === 0) return null

  return (
    <div className={className}>
      <List
        height={height}
        itemCount={items.length}
        itemSize={itemHeight}
        width="100%"
        overscanCount={5}
      >
        {Row}
      </List>
    </div>
  )
}

export default VirtualList
