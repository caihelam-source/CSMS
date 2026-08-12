/**
 * 复制预览区 HTML 到剪贴板（用于把 A4 预览粘贴进 Word / 邮件）。
 *
 * 安全：不引第三方库；navigator.clipboard 失败时降级为 textarea + execCommand('copy')。
 * 不使用 eval / new Function。
 */

/** 最小 .doc-* 内联样式，保证粘贴到 Word 后保留基本排版。 */
const MINIMAL_DOC_CSS = `
.doc-page { width: 794px; min-height: 1123px; padding: 64px; box-sizing: border-box; font-family: "Songti SC","SimSun",serif; font-size: 14px; line-height: 1.8; color: #111; background: #fff; }
.doc-title { font-size: 22px; font-weight: 700; text-align: center; margin: 0 0 8px; }
.doc-subtitle { font-size: 13px; text-align: center; color: #555; margin: 0 0 24px; }
.doc-h2 { font-size: 16px; font-weight: 700; margin: 18px 0 8px; }
.doc-p { margin: 8px 0; }
.doc-p-flat { margin: 4px 0; }
.doc-blank { display: inline-block; min-width: 80px; border-bottom: 1px solid #111; }
.doc-list { margin: 8px 0 8px 20px; padding-left: 4px; }
.doc-ol { margin: 8px 0 8px 24px; }
.doc-sign-grid { margin-top: 32px; display: flex; flex-wrap: wrap; gap: 24px; }
.doc-sign-row { min-width: 200px; }
.doc-sign-label { font-size: 12px; color: #555; }
.doc-rule { border: none; border-top: 1px solid #111; margin: 16px 0; }
.doc-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
.doc-table td, .doc-table th { border: 1px solid #111; padding: 4px 8px; }
.doc-center { text-align: center; }
.doc-quote { border-left: 3px solid #999; padding-left: 12px; color: #444; }
.doc-box { font-family: monospace; }
.doc-meta { font-size: 12px; color: #555; }
.doc-note { color: #b45309; font-size: 12px; }
.doc-divider { border: none; border-top: 1px solid #111; margin: 16px 0; }
.doc-line { border-bottom: 1px solid #111; min-height: 28px; }
.doc-empty { color: #999; }
`;

/**
 * 把预览容器 DOM 克隆并包成独立 A4 HTML 字符串。
 * @param {HTMLElement|null} previewEl 预览容器（previewRef.current）
 * @returns {string} 完整 HTML 文档字符串（失败返回 ''）
 */
export function serializePreviewToHtml(previewEl) {
  if (!previewEl || typeof previewEl.cloneNode !== 'function') return '';
  const clone = previewEl.cloneNode(true);
  const title =
    (typeof document !== 'undefined' && document.title) || 'Document';
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return (
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
    `<title>${escapedTitle}</title>` +
    `<style>${MINIMAL_DOC_CSS}</style></head>` +
    `<body><div class="doc-page">${clone.innerHTML}</div></body></html>`
  );
}

/**
 * 复制 HTML 到剪贴板。优先 navigator.clipboard.writeText，失败降级 execCommand。
 * @param {string} html HTML 字符串
 * @returns {Promise<boolean>} 是否成功复制
 */
export async function copyHtmlToClipboard(html) {
  if (typeof html !== 'string' || !html) return false;

  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(html);
      return true;
    } catch {
      // 降级路径
    }
  }

  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = html;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
    document.body.removeChild(textarea);
    return !!ok;
  } catch {
    return false;
  }
}
