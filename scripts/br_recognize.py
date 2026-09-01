"""
Hong Kong Business Registration Certificate (商業登記證) recognizer
→ CSMS Company.brExpiryDate (+ businessRegistrationNumber when present)

- CSMS Company 模型 brExpiryDate 字段已存在（Date 类型），本脚本只识别填充。
- BR 证可能为文本 PDF（可自动抽）或扫描件（需 OCR，本沙箱无 tesseract，
  因此扫描件输出 ocr_pending 标记并支持 CLI --manual 注入识别值）。

Usage:
    python br_recognize.py [pdf ...]                          # 自动识别
    python br_recognize.py --manual '{"brNumber":"...","brExpiryDate":"2024-03-31",...}' path/to/cert.pdf
"""
import sys, os, re, json, glob, argparse
import pdfplumber

def _has_text(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        for pg in pdf.pages:
            if (pg.extract_text() or "").strip():
                return True
    return False

def _norm_date(d, m, y):
    """把 d/m/y 三个数字组成 ISO yyyy-mm-dd。"""
    try:
        return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"
    except Exception:
        return None

def parse_text(text):
    """从文本层抽 BR 证固定版式字段。"""
    out = {}
    # 1. Certificate No. (BR 号：前 8 位数字)
    m = re.search(r"Certificate\s*No\.?[^\d]*(\d{8})(?:-\d+-\d+-\d+)?", text)
    if not m:
        m = re.search(r"登記證號碼[^\d]*(\d{8})", text)
    if m:
        out["brNumber"] = m.group(1)

    # 2. Date of Commencement (生效日期)
    m = re.search(r"Date of Commencement[^\d]*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})", text)
    if m:
        out["brCommencementDate"] = _norm_date(m.group(1), m.group(2), m.group(3))
    m = re.search(r"生效日期[^\d]*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})", text)
    if m and "brCommencementDate" not in out:
        out["brCommencementDate"] = _norm_date(m.group(1), m.group(2), m.group(3))

    # 3. Date of Expiry (BR 有效期 → brExpiryDate)
    m = re.search(r"Date of Expiry[^\d]*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})", text)
    if m:
        out["brExpiryDate"] = _norm_date(m.group(1), m.group(2), m.group(3))
    m = re.search(r"屆滿日期[^\d]*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})", text)
    if m and "brExpiryDate" not in out:
        out["brExpiryDate"] = _norm_date(m.group(1), m.group(2), m.group(3))

    # 4. Name of Business (中英对照)
    m = re.search(r"Name of Business[^\n]*\n([^\n]+)\n([^\n]+)", text)
    if m:
        out["nameEnglish"] = m.group(1).strip()
        if re.search(r"[\u4e00-\u9fff]", m.group(2)):
            out["nameChinese"] = m.group(2).strip()

    # 5. Address (业务地址)
    m = re.search(r"Address[^\n]*\n([^\n]+(?:\n[^\n]+){0,5})", text)
    if m:
        out["addressRaw"] = re.sub(r"\s+", " ", m.group(1).replace("\n", ", ")).strip(" ,")

    # 6. Nature of Business
    m = re.search(r"Nature of Business[^\n]*\n([^\n]+)", text)
    if m:
        out["businessNature"] = m.group(1).strip()

    # 7. Status
    m = re.search(r"Status[^\n]*\n([^\n]+)", text)
    if m:
        out["status"] = m.group(1).strip()

    return out

def recognize(pdf_path, manual=None):
    rec = {"sourceFile": os.path.basename(pdf_path), "path": pdf_path, "fields": {}, "ocrStatus": "pending"}
    if manual:
        # 人工/多模态识别注入（扫描件场景）
        rec["fields"] = {k: v for k, v in manual.items()}
        rec["ocrStatus"] = "manual_injected"
        rec["note"] = "扫描件，沙箱无 OCR；值由人工/多模态识别注入"
        return rec
    try:
        if not _has_text(pdf_path):
            rec["ocrStatus"] = "ocr_pending"
            rec["note"] = "BR 证为扫描件（无文本层），沙箱无 tesseract；需 OCR 或人工注入"
            return rec
        with pdfplumber.open(pdf_path) as pdf:
            text = "\n".join((pg.extract_text() or "") for pg in pdf.pages)
        rec["fields"] = parse_text(text)
        rec["ocrStatus"] = "extracted"
    except Exception as e:
        rec["ocrStatus"] = "error"
        rec["error"] = str(e)
    return rec

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*", help="BR 证 PDF 文件")
    ap.add_argument("--manual", type=str, default=None,
                    help="JSON 字符串：扫描件的人工识别值，如 '{\"brNumber\":\"65940948\",\"brExpiryDate\":\"2024-03-31\"}'")
    args = ap.parse_args()
    files = args.files or sorted(glob.glob("client/public/docs/*BR*.pdf"))
    manual = json.loads(args.manual) if args.manual else None
    results = [recognize(f, manual) for f in files]
    out = {"count": len(results), "results": results}
    with open("scripts/_br_recognized.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    for r in results:
        f = r.get("fields", {})
        print(f"=== {r['sourceFile']} [{r['ocrStatus']}] ===")
        print(f"  BR号: {f.get('brNumber')}  生效: {f.get('brCommencementDate')}  届滿: {f.get('brExpiryDate')}")
        print(f"  公司: {f.get('nameEnglish')} / {f.get('nameChinese')}")
        print(f"  业务: {f.get('businessNature')}  状态: {f.get('status')}")
        if r.get("note"):
            print(f"  注: {r['note']}")

if __name__ == "__main__":
    main()
