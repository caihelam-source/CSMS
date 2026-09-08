#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HK CI (公司注册证明书 / Certificate of Incorporation) -> CSMS-shaped recognizer.

识别字段：
  - companyName        公司英文名
  - companyNameChinese 公司中文名
  - registrationNumber 公司注册号（CR No.，如「1234567」；如 BR 号已有则保留 BR 号为主键）
  - incorporationDate  注册日期（ISO YYYY-MM-DD）
  - businessNature     业务性质（CL 表）

兼容纯扫描件（chars=0 + imgs>0）→ 标 needsMultimodal=true，由多模态通道或人工补录。
"""
import pdfplumber, re, json, os, sys

def load_text(path):
    pages = []
    with pdfplumber.open(path) as pdf:
        for p in pdf.pages:
            pages.append(p.extract_text() or "")
    return "\n".join(pages), len(pages)

def is_scanned(path, text=None, char_threshold=80):
    if text is None:
        text, _ = load_text(path)
    if len(text.strip()) < char_threshold:
        return True
    with pdfplumber.open(path) as pdf:
        total_chars = sum(len(pg.chars) for pg in pdf.pages)
        total_imgs = sum(len(pg.images) for pg in pdf.pages)
    return total_chars < char_threshold and total_imgs > 0

def _parse_eng_date(s):
    """English ordinal date -> ISO. e.g. '20th day of February, 2024' / 'February 20, 2024'"""
    if not s:
        return None
    month_map = {
        "january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
        "july":7,"august":8,"september":9,"october":10,"november":11,"december":12,
        "jan":1,"feb":2,"mar":3,"apr":4,"jun":6,"jul":7,"aug":8,"sep":9,"sept":9,"oct":10,"nov":11,"dec":12,
    }
    # 20th day of February, 2024
    m = re.search(r"(\d{1,2})(?:st|nd|rd|th)?\s*day\s*of\s*([A-Za-z]+)\s*,?\s*(\d{4})", s, re.I)
    if m:
        d, mon, y = int(m.group(1)), month_map.get(m.group(2).lower()), int(m.group(3))
        if mon:
            return f"{y:04d}-{mon:02d}-{d:02d}"
    # February 20, 2024 / 20 February 2024
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})", s)
    if m:
        mon = month_map.get(m.group(1).lower())
        if mon:
            d, y = int(m.group(2)), int(m.group(3))
            return f"{y:04d}-{mon:02d}-{d:02d}"
    m = re.search(r"(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})", s)
    if m:
        mon = month_map.get(m.group(2).lower())
        if mon:
            d, y = int(m.group(1)), int(m.group(3))
            return f"{y:04d}-{mon:02d}-{d:02d}"
    # 中文：本证书于〔YYYY年MM月DD日〕发出 / 成立为 DATE
    m = re.search(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", s)
    if m:
        return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return None

def parse_ci(text):
    out = {"name": None, "nameChinese": None, "registrationNumber": None,
           "incorporationDate": None, "businessNature": None}
    if not text:
        return out

    # 1) 公司英文名：CI 顶部 Name in English / 「I hereby certify that ... is incorporated...」
    m = re.search(r"Name in English\s*\n\s*([^\n]+?)\s*\n", text)
    if m:
        cand = m.group(1).strip()
        if cand and len(cand) > 2:
            out["name"] = cand
    if not out["name"]:
        m = re.search(r"I hereby certify that (.+?) is incorporated in", text, re.I)
        if m:
            out["name"] = m.group(1).strip()

    # 2) 公司中文名
    m = re.search(r"中文名稱\s*Name in Chinese\s*\n\s*([^\n]+)", text)
    if m:
        out["nameChinese"] = m.group(1).strip()
    elif not out["nameChinese"]:
        m = re.search(r"Name in Chinese\s*\n\s*([^\n]+)", text)
        if m and re.search(r"[\u4e00-\u9fff]", m.group(1)):
            out["nameChinese"] = m.group(1).strip()

    # 3) CR 号：7 位数字 + (Some text) / Company Number
    m = re.search(r"公司編號\s*Company Number[^\n]*\n?\s*([0-9]{4,8})", text)
    if not m:
        m = re.search(r"Company Number\s*[:.]?\s*([0-9]{4,8})", text)
    if not m:
        m = re.search(r"Certificate of Incorporation\s*No[.\s]*([0-9]{4,8})", text, re.I)
    if m:
        out["registrationNumber"] = m.group(1).strip()

    # 4) 注册日：「Incorporated on ...」/「本證明書於…成立」
    inc_text_blocks = []
    m = re.search(r"Incorporated this\s+([^\n]+)", text, re.I)
    if m:
        inc_text_blocks.append(m.group(1))
    m = re.search(r"on the\s+(\d{1,2}(?:st|nd|rd|th)?\s*day[^\n]+?\d{4})", text, re.I)
    if m:
        inc_text_blocks.append(m.group(1))
    # 中文版：根據《公司條例》在香港成立為 … 本證明書於…
    m = re.search(r"在香港成立為[^\n]*?於\s*([^\n]*?\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)", text)
    if m:
        inc_text_blocks.append(m.group(1))
    # fallback: 整段 'on this ... incorporated' 区段
    m = re.search(r"on this\s+([^\n]+)", text, re.I)
    if m:
        inc_text_blocks.append(m.group(1))

    for blk in inc_text_blocks:
        iso = _parse_eng_date(blk)
        if iso:
            out["incorporationDate"] = iso
            break

    # 5) 业务性质 (CL 表)
    m = re.search(r"business\s*as[^\n]*\n?\s*([^\n]+)", text, re.I)
    if m:
        out["businessNature"] = m.group(1).strip()

    return out

def render_scan_pages(path, out_dir="scripts", prefix=None, dpi=200):
    import hashlib
    os.makedirs(out_dir, exist_ok=True)
    if prefix is None:
        base = os.path.splitext(os.path.basename(path))[0]
        safe = re.sub(r"[^\w\-]+", "_", base)[:30].strip("_") or hashlib.md5(path.encode()).hexdigest()[:8]
        prefix = f"_scan_{safe}"
    paths = []
    with pdfplumber.open(path) as pdf:
        for i, pg in enumerate(pdf.pages, 1):
            out = os.path.join(out_dir, f"{prefix}_p{i}.png")
            pg.to_image(resolution=dpi).save(out)
            paths.append(out)
    return paths

def recognize(path, render_scan=True):
    text, n = load_text(path)
    scanned = is_scanned(path, text)
    scan_images = render_scan_pages(path) if (scanned and render_scan) else []
    company = parse_ci(text)
    found = sum(1 for v in company.values() if v)
    confidence = "high" if found >= 3 else ("medium" if found >= 1 else "gap")
    return {
        "sourceFile": os.path.basename(path),
        "pages": n,
        "formKind": "CI",
        "formKindName": "公司注册证明书 Certificate of Incorporation",
        "scanned": scanned,
        "needsMultimodal": scanned,
        "scanImages": scan_images,
        "version": "Spec 2/2025 (text)" if not scanned else "scanned",
        "confidence": confidence,
        "company": company,
        "documentAssociation": {
            "scope": "company",
            "docType": "CI",
            "docTypeName": "Certificate of Incorporation",
            "incorporationDate": company.get("incorporationDate"),
            "note": ("CI 作为公司关联文件挂 Company 下（scope=company）；"
                     "导入后自动回填 Company.incorporationDate / 注册号 / 公司名"),
        },
        "gaps": {
            "incorporationDate": "由 CI 证「Incorporated this ...」/「...於...成立」抽取"
                                 + ("；当前 PDF 为纯扫描件，需 OCR/多模态" if scanned else ""),
            "registrationNumber": "CR 号（7 位数字）已抽取；如 BR 号已有，registrationNumber 字段保持 BR 号为主键",
        },
    }

def main():
    args = sys.argv[1:]
    stdout_mode = "--stdout" in args
    if stdout_mode:
        args.remove("--stdout")
    files = args or sorted([p for p in __import__("glob").glob("client/public/docs/*CI*.pdf")])
    if not files:
        print(json.dumps({"count": 0, "results": [], "error": "no input"}, ensure_ascii=False))
        return
    results = [recognize(f, render_scan=not stdout_mode) for f in files]
    if stdout_mode:
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
        print(json.dumps({"count": len(results), "results": results}, ensure_ascii=False))
        return
    for r in results:
        c = r["company"]
        tag = "scan" if r.get("scanned") else "text"
        print(f"=== [{tag}] {r['sourceFile']} ({r['pages']}p, conf={r['confidence']}) ===")
        print(f"  公司: {c.get('name')} / {c.get('nameChinese')}")
        print(f"  注册号: {c.get('registrationNumber')}  注册日: {c.get('incorporationDate')}")
        if r.get("needsMultimodal") and not stdout_mode:
            print(f"  待多模态: {r.get('scanImages')}")

if __name__ == "__main__":
    main()
