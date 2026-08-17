// 日历通用状态组件：错误态 / 空态
// 关键（P0-1）：请求失败时显示显式错误态（带重试），不再静默为「暂无事件」；
// 仅当接口成功且数据为空时才显示空态。

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-3xl mb-3">⚠️</div>
      <p className="text-sm text-danger font-medium mb-1">日历数据加载失败</p>
      <p className="text-xs text-ink-3 mb-4 max-w-sm px-4">
        {error?.message || '请检查网络或后端服务后重试'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="tap-target px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          重试
        </button>
      )}
    </div>
  )
}

export function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-ink-3">
      <p className="text-sm">{text || '暂无事件'}</p>
    </div>
  )
}
