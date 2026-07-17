import { Component } from 'react'

/**
 * 通用错误边界。
 * - 捕获子树渲染期异常，显示隔离错误页（不再全站白屏）。
 * - resetKey 变化时自动复位（默认传入 location.pathname），
 *   避免"某页报错后错误页卡死、跳走也清不掉"的体验问题。
 * - 顶层（包在 AuthProvider 外）与路由层都能复用。
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    // 把错误打到控制台，便于排查（否则错误被"吞进"隔离页里看不见）
    console.error('[ErrorBoundary]', error, errorInfo)
    this.setState({ errorInfo })
  }

  // 路由切换时复位错误状态，让一次页面崩溃不至于永久困在错误页
  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, errorInfo: null })
    }
  }

  handleRetry = () => {
    this.setState({ error: null, errorInfo: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-danger/10 p-8 font-mono text-sm overflow-auto">
          <h1 className="text-xl font-bold text-danger mb-4">
            ⚠️ 页面渲染出错（已隔离，不影响其他页面）
          </h1>
          <pre className="bg-surface border border-danger/20 rounded-lg p-4 text-danger whitespace-pre-wrap break-all">
{this.state.error.message}
{'\n\n'}
{this.state.error.stack || ''}
          </pre>
          {this.state.errorInfo && (
            <details className="mt-4">
              <summary className="cursor-pointer text-danger font-semibold">组件堆栈</summary>
              <pre className="mt-2 bg-surface border border-danger/20 rounded-lg p-3 text-xs text-ink-2 whitespace-pre-wrap">
{this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button onClick={this.handleRetry} className="mt-6 btn-secondary">
            重试当前页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
