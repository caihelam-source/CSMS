/**
 * Lightweight region inference — no docx dependency.
 * Extracted from docxCommon.js so pages can infer region without
 * pulling the heavy docx library into their chunk.
 */

export function inferRegion(company) {
  const j = String(company?.jurisdiction || '').toLowerCase();
  if (j.includes('bvi') || j.includes('virgin') || j.includes('british')) return 'BVI';
  return 'HK';
}
