/**
 * 文档文件访问工具
 * ───────────────────────────────────────────────────────────
 * 预览/下载一律走后端鉴权路由 /api/documents/:id/view | /download，
 * 由后端用存储凭证取字节流式返回：
 *   - 本地模式：fileUrl 是相对路径，跨域（前端 claw-web ≠ 后端 claw-api）下
 *     <iframe>/<img>/<a> 按前端域名解析会 404 → 改为同源后端路由。
 *   - R2 模式：fileUrl 是公开 URL，私有桶/地址错误时打不开 → 后端用凭证取，不依赖公开 URL。
 *   - 跨域鉴权：<a>/<iframe>/<img> 无法带 Authorization，故前端用 api(带 Bearer)
 *     fetch blob → URL.createObjectURL 后喂给 <iframe>/<img>。
 */
import api from '../services/api.js';

// 取文档字节，返回可用于 <iframe src>/<img src> 的 blob object URL
export async function fetchDocBlobUrl(docId) {
  const res = await api.get(`/api/documents/${docId}/view`, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
}

// 触发浏览器下载（鉴权流式返回，规避跨域公开 URL 问题）
export async function downloadDoc(doc) {
  const res = await api.get(`/api/documents/${doc._id}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.fileName || doc.name || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// 由文件名/URL 推断扩展名，用于判断预览渲染方式
export function docExt(doc) {
  const name = doc?.fileName || doc?.name || doc?.fileUrl || '';
  const m = name.match(/\.([a-z0-9]+)$/i);
  return (m ? m[1] : '').toLowerCase();
}

export function isPdfDoc(doc) {
  return docExt(doc) === 'pdf';
}

export function isImageDoc(doc) {
  return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(docExt(doc));
}
