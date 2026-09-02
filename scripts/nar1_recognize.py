#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HK NAR1 (周年申報表 / Annual Return) -> CSMS-shaped recognizer.
针对标准 NAR1（Companies Registry Specification 2/2025 固定版式）抽取 CSMS 维度，
结构化输出并标注置信度/缺口。不写库，仅识别。

人名提取（董事 / 自然人公司秘书）使用 pdfplumber 词坐标：NAR1 表单为双栏，
姓名【真实值】全部落在右栏（x0≈198）。每个自然人区块内右栏值按纵向顺序为：
  [中文姓名(CJK), 英文姓氏(ASCII), 英文名字(ASCII)]
故：CJK 值 -> nameChinese；ASCII 值按顺序 -> "SURNAME GIVEN"。
这避免了旧版只用「Name in English Surname\\n下一行」把【名字】误当【姓氏】、
从而漏掉真实姓氏、且中文名/英文名错位的问题。
"""
import pdfplumber, re, json, glob, os, sys

LABELS = ("Company Name", "Business Name", "Name in English", "Name in Chinese",
          "Surname", "Other Names", "Previous Names", "Alias", "Correspondence",
          "Address", "Email Address", "Identification", "Partial Number",
          "中文姓名", "英文姓名", "名字", "前用姓名", "別名", "通訊地址", "電郵地址",
          "身分識別", "部分號碼", "室", "樓", "座", "大廈", "街道", "區", "地區")

# 右栏（真实值列）x 坐标范围；标签均在 x0<183，地址值也在右栏但位于姓名带下方（靠 top 区间排除）
RIGHT_X_MIN = 183.0
RIGHT_X_MAX = 285.0

ADDR_STRIP = [
    r"室／樓／座等", r"Flat／Floor／Block etc\.", r"大廈", r"街道／屋苑／地段／村等",
    r"Street／Estate／Lot／Village etc\.", r"District", r"地區", r"Region", r"區",
    r"區／市／省／州／郵遞區號等", r"市／省／州／郵遞[^\n]*", r"City／Province／[^\n]*",
    r"State／Postal Code etc\.", r"國家／地區", r"國家／", r"Country／Region", r"Country／",
    r"District／City／Province／[^\n]*", r" District ", r" Region ", r" Building ",
    r"本處專用[^\n]*", r"For Official Use", r"Document Ref\. No\.:\s*[^\n]*",
    r"Submission Date:\s*[^\n]*", r"Resubmission Date:\s*[^\n]*",
    r"指明編號[^\n]*", r"Specification No\.[^\n]*", r"Page \d+/\d+頁",
    r"表格", r"商業登記號碼", r"NAR1 Form\s*\d+", r"NAR1\s*\d+", r"Form\s*\d+",
    r"商業登記號碼\s*Business Registration Number", r"Business Registration Number",
    r"通訊地址\s*Correspondence\s*Address", r"Address of Registered Office in Hong Kong",
]

def clean_addr_text(block):
    """剥离 NAR1 固定版式的双语表单标签与页脚，保留真实地址文本。"""
    txt = block
    for pat in ADDR_STRIP:
        txt = re.sub(pat, " ", txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt or None

def extract_addr_structured(block):
    """按 NAR1 地址字段标签前缀提取值（室／樓／座等、大廈、地區），得到干净地址。"""
    parts = []
    m = re.search(r"室／樓／座等\s*([^\n]+)", block)
    if m:
        v = m.group(1).strip().rstrip(",")
        if v:
            parts.append(v)
    m = re.search(r"大廈\s*([^\n]+)", block)
    if m:
        v = re.sub(r"^\s*Building\s*", "", m.group(1).strip().rstrip(","), flags=re.I)
        if v:
            parts.append(v)
    m = re.search(r"地區\s*([^\n]+)", block)
    if m:
        v = m.group(1).strip()
        if v:
            parts.append(v)
    if len(parts) >= 2:
        return ", ".join(parts)
    return clean_addr_text(block)

def load_text(path):
    pages = []
    with pdfplumber.open(path) as pdf:
        n = len(pdf.pages)
        for p in pdf.pages:
            pages.append(p.extract_text() or "")
    return "\n".join(pages), n

def is_scanned(path, text=None, char_threshold=80):
    """扫描件 PDF 检测：文本层空或字符极少 + 有图。"""
    if text is None:
        text, _ = load_text(path)
    if len(text.strip()) < char_threshold:
        return True
    with pdfplumber.open(path) as pdf:
        total_chars = sum(len(pg.chars) for pg in pdf.pages)
        total_imgs = sum(len(pg.images) for pg in pdf.pages)
    return total_chars < char_threshold and total_imgs > 0

def render_scan_pages(path, out_dir="scripts", prefix=None, dpi=200):
    """把扫描件 PDF 各页渲染为 PNG，返回图片路径列表。prefix 默认取自文件名前 30 字符安全化。"""
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

SEP = "\n"

def block_after(text, start_anchor, stop_anchors):
    idx = -1
    for a in start_anchor:
        m = re.search(a, text)
        if m:
            idx = m.end()
            break
    if idx < 0:
        return ""
    blk = text[idx:]
    for sa in stop_anchors:
        mm = re.search(sa, blk)
        if mm:
            blk = blk[:mm.start()]
            break
    return blk

def nonlabel_line(lines):
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        if any(ln == L or ln.startswith(L) for L in LABELS):
            continue
        if re.match(r"^[\d]+\s*$", ln):
            continue
        return ln
    return ""

def _is_cjk(s):
    return bool(re.search(r"[\u4e00-\u9fff]", s or ""))

def parse_company(text):
    c = {}
    m = re.search(r"1 公司名稱 Company Name\s*\n\s*([^\n]+)\s*\n\s*([^\n]+)", text)
    if m:
        c["name"] = m.group(1).strip()
        c["nameChinese"] = m.group(2).strip() if re.search(r"[\u4e00-\u9fff]", m.group(2)) else None
    else:
        c["name"] = None
        c["nameChinese"] = None

    m = re.search(r"商業登記號碼\s*Business Registration Number\s*\n\s*([0-9 ]+)", text)
    c["brNumber"] = re.sub(r"\s", "", m.group(1)) if m else None  # gap: CSMS 无 brNumber 字段

    m = re.search(r"Date to which this Return is Made Up[^\d]*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})", text)
    c["arMadeUpDate"] = f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else None

    c["type"] = "review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)"
    c["jurisdiction"] = "HK"
    c["status"] = "active"

    blk = block_after(text, [r"6 在香港的註冊辦事處地址", r"Address of Registered Office in Hong Kong"],
                      [r"7 電郵地址", r"Email Address"])
    c["registeredAddressRaw"] = extract_addr_structured(blk)

    m = re.search(r"普通股\s*(HKD|USD|CNY|EUR|GBP|港元)\s*([\d,]+)\s*([\d,]+)\s*([\d,]+)", text)
    if m:
        cur = "HKD" if m.group(1) == "港元" else m.group(1)
        c["shareCapital"] = {"shareType": "ordinary", "currency": cur,
                             "issuedShares": _num(m.group(2)), "totalAmount": _num(m.group(3)),
                             "paidUpAmount": _num(m.group(4))}
    else:
        blk11 = block_after(text, [r"11 股本", r"Share Capital"], [r"12 公司秘書", r"Company Secretary"])
        m2 = re.search(r"(HKD|USD|CNY|EUR|GBP|港元)\s*([\d,]+)\s*([\d,]+)\s*([\d,]+)", blk11)
        if m2:
            cur = "HKD" if m2.group(1) == "港元" else m2.group(1)
            c["shareCapital"] = {"shareType": "ordinary", "currency": cur,
                                 "issuedShares": _num(m2.group(2)), "totalAmount": _num(m2.group(3)),
                                 "paidUpAmount": _num(m2.group(4))}
        else:
            c["shareCapital"] = None

    c["registrationNumber"] = c.get("brNumber")  # NAR1 不印 CR 号：CSMS registrationNumber 字段映射到 BR 号（决策 09-01）
    c["registrationNumberSource"] = "BR号(NAR1)"   # 审计字段：标"BR号"以便日后接 CI 证回填 CR 号时区分
    c["incorporationDate"] = None   # gap: 需 CI 注册证明书
    c["brExpiryDate"] = None        # gap: 由 BR 证提供（见 br_recognize.py）
    c["financialYearEnd"] = None    # gap: NAR1 通常空白
    return c

def _num(s):
    try:
        return int(s.replace(",", ""))
    except:
        return None

def _is_label(v):
    v = v.strip()
    return any(v == L or v.startswith(L) or L in v for L in LABELS)

def _is_real_name(v):
    if not v:
        return False
    v = v.strip()
    if _is_label(v):
        return False
    if re.search(r"Name in (English|Chinese)|中文名稱|英文名稱|名字|別名|前用姓名|通訊地址|電郵|地址|Address|香港|Hong Kong|室|樓|座|大廈|街道|區|地區|Hong|Kong|ROOM|Flat|Floor|Block|Building|Road|Street|WANCHAI|Wan|Harbour|RESOURCES|VISTRA|TOWN|TORTOLA|Wickhams|Centre|CHINA|CORP", v, re.I):
        return False
    return True

# ---------------------------------------------------------------------------
# 人名坐标提取（董事 / 自然人公司秘书）
# ---------------------------------------------------------------------------

def _page_is_secretary(words):
    return any(w["text"] == "Secretary" for w in words) or any(w["text"] == "秘書" for w in words)

def _page_is_director(words):
    has_dir = any(w["text"] == "Directors" for w in words) or any(w["text"] == "董事" for w in words)
    has_sec = any(w["text"] == "Secretary" for w in words)
    return has_dir and not has_sec

def extract_natural_persons(words, role):
    """从单页 words 中用右栏坐标提取自然人姓名块。

    每个「中文姓名」标签开启一个自然人；其姓名值（右栏 x0∈[RIGHT_X_MIN,RIGHT_X_MAX]）
    按 top 排序为 [中文名(CJK), 英文姓氏(ASCII), 英文名字(ASCII)]。
    返回 list of {entityType, role, name, nameChinese, confidence}。
    """
    cn_labels = [w for w in words if w["text"] == "中文姓名"]
    if not cn_labels:
        return []
    # 姓名带的上界：遇到「前用姓名 / 別名」(Previous Names / Alias) 即止，避免把别名/曾用名并入姓名
    alias_anchors = {"前用姓名", "別名", "Previous", "Alias"}
    persons = []
    for i, lab in enumerate(cn_labels):
        start = lab["top"] - 2
        # 上界 = min(下一个人 中文姓名, 本节 前用姓名/別名 标签) - 2
        bounds = []
        if i + 1 < len(cn_labels):
            bounds.append(cn_labels[i + 1]["top"] - 2)
        for w in words:
            if w["text"] in alias_anchors and w["top"] > lab["top"]:
                bounds.append(w["top"] - 2)
                break
        end = min(bounds) if bounds else lab["top"] + 130
        vals = [w for w in words
                if RIGHT_X_MIN <= w["x0"] <= RIGHT_X_MAX and start <= w["top"] <= end
                and w["text"] and not w["text"].startswith("\uf0dd")]
        vals.sort(key=lambda w: w["top"])
        cjk = [w for w in vals if _is_cjk(w["text"])]
        asc = [w for w in vals if not _is_cjk(w["text"])]
        nameChinese = "".join(w["text"] for w in cjk) if cjk else None
        if asc:
            surname = asc[0]["text"].strip()
            given = " ".join(w["text"].strip() for w in asc[1:]) if len(asc) > 1 else ""
            name = (surname + (" " + given if given else "")).strip()
        else:
            name = None
        if name or nameChinese:
            persons.append({"entityType": "person", "role": role,
                            "name": name, "nameChinese": nameChinese,
                            "confidence": "high"})
    return persons

def extract_nric_address_from_text(text):
    """从全文本提取（自然人）香港身份证/护照部分号 + 通讯地址。应用于整段（整页共享）。"""
    nricPartial = None
    idType = None
    m = re.search(r"香港身分證部分號碼\s*Partial Number[^\n]*\n\s*([A-Z]\d{3})", text)
    if m:
        nricPartial = m.group(1)
        idType = "HKID(partial)"
    else:
        mp = re.search(r"護照[^\n]*部分號碼\s*Partial Number\s*\n\s*([A-Za-z0-9]+)", text)
        if mp and mp.group(1) != "-":
            nricPartial = mp.group(1)
            idType = "Passport(partial)"
    ab = block_after(text, [r"通訊地址\s*Correspondence\s*Address", r"Correspondence\s*Address"],
                     [r"電郵地址", r"Email Address", r"身分識別", r"Identification", r"前用姓名", r"Previous"])
    addressRaw = clean_addr_text(ab)
    return nricPartial, idType, addressRaw

def parse_secretary(text, pages_words):
    out = []
    # 自然人 A（坐标提取，逐页）
    for words in pages_words:
        if _page_is_secretary(words):
            nat = extract_natural_persons(words, "secretary")
            if nat:
                nric, idt, addr = extract_nric_address_from_text(text)
                for p in nat:
                    p["nricPartial"] = nric
                    p["idType"] = idt
                    p["addressRaw"] = addr
                out.extend(nat)
    # 法人團體 B（文本提取）
    blk = block_after(text, [r"12 公司秘書", r"Company Secretary"],
                      [r"13 董事", r"Directors"])
    corp = block_after(blk, [r"B\. 公司秘書 \(法人團體\)", r"Company Secretary \(Body Corporate\)"],
                       [r"13 董事", r"Directors", r"指明編號"])
    if re.search(r"法人團體|Body Corporate", corp):
        cn = re.search(r"中文名稱\s*Name in Chinese\s*\n\s*([^\n]+)", corp)
        en = re.search(r"英文名稱\s*Name in English\s*\n\s*([^\n]+)", corp)
        en_ok = bool(en and _is_real_name(en.group(1)))
        cn_ok = bool(cn and _is_real_name(cn.group(1)))
        if en_ok or cn_ok:
            out.append({"entityType": "company", "role": "secretary",
                        "name": en.group(1).strip() if en else None,
                        "nameChinese": cn.group(1).strip() if cn else None,
                        "confidence": "high",
                        "note": "法人團體公司秘書 -> CSMS Company.links(linkModel=Company, roles=[secretary])"})
    if not out:
        out.append({"entityType": "unknown", "role": "secretary", "name": None, "confidence": "gap"})
    return out

def parse_directors(text, pages_words):
    out = []
    for words in pages_words:
        if _page_is_director(words):
            ds = extract_natural_persons(words, "director")
            if ds:
                nric, idt, addr = extract_nric_address_from_text(text)
                for p in ds:
                    p["nricPartial"] = nric
                    p["idType"] = idt
                    p["addressRaw"] = addr
                out.extend(ds)
    if not out:
        out.append({"entityType": "unknown", "role": "director", "name": None, "confidence": "review"})
    return out

def parse_shareholders(text):
    blk = block_after(text, [r"附表一 Schedule 1", r"Schedule 1"],
                      [r"附表二", r"Schedule 2", r"附表一 第"])
    out = []
    for m in re.finditer(r"英文名稱\s+([A-Z][A-Za-z0-9 .,&'()\-]*?)\s+Shares are Jointly Held", blk):
        name = m.group(1).strip()
        if not name:
            continue
        sm = re.search(r"英文姓名\s*([\d,]+)", blk[:m.start()])
        shares = _num(sm.group(1)) if sm else None
        ab = block_after(blk[m.start():], [r"地址\s*Address", r"Address"],
                         [r"備註", r"Remarks", r"中文姓名", r"Name in Chinese", r"英文名稱", r"持有股份"])
        country = None
        cm = re.search(r"(British Virgin Islands|Cayman Islands|Hong Kong|China|Singapore|Samoa|Seychelles|Mauritius|Delaware|United Kingdom|USA|United States)", ab, re.I)
        if cm:
            country = cm.group(1).strip()
        is_corp = bool(re.search(r"(LIMITED|LTD|INC|CORP|CORPORATION|HOLDINGS|INVESTMENTS|GROUP|BV|LLC|SARL|PLC|有限公司|集團|投資|控股)", name, re.I))
        out.append({
            "entityType": "company" if is_corp else "person", "role": "shareholder",
            "name": name, "nameChinese": None, "shares": shares, "shareType": "ordinary",
            "country": country, "confidence": "high",
            "note": ("法人股东 -> CSMS Company.links(linkModel=Company, roles=[shareholder], shares, shareType=ordinary)"
                     if is_corp else "自然人股东 -> CSMS Company.links(linkModel=Personnel, roles=[shareholder], shares, shareType=ordinary)"),
        })
    if not out:
        out.append({"entityType": "unknown", "role": "shareholder", "name": None, "confidence": "gap"})
    return out

def recognize(path, render_scan=True):
    pages_text = []
    pages_words = []
    with pdfplumber.open(path) as pdf:
        n = len(pdf.pages)
        for p in pdf.pages:
            pages_text.append(p.extract_text() or "")
            pages_words.append(p.extract_words())
    text = "\n".join(pages_text)
    scanned = is_scanned(path, text)
    scan_images = render_scan_pages(path) if (scanned and render_scan) else []
    company = parse_company(text)
    secretary = parse_secretary(text, pages_words)
    directors = parse_directors(text, pages_words)
    shareholders = parse_shareholders(text)
    sm = re.search(r"日期\s*Date\s*:\s*(\d{1,2})/(\d{1,2})/(\d{4})", text)
    ar_filed = f"{sm.group(3)}-{int(sm.group(2)):02d}-{int(sm.group(1)):02d}" if sm else None
    return {
        "sourceFile": os.path.basename(path), "pages": n,
        "scanned": scanned,
        "needsMultimodal": scanned,
        "scanImages": scan_images,
        "narVersion": "Spec 1/2014 (scanned)" if scanned else "Spec 2/2025 (text)",
        "company": company, "companySecretary": secretary, "directors": directors,
        "shareholders": shareholders,
        "documentAssociation": {
            "scope": "company", "docType": "NAR1",
            "docTypeName": "周年申報表 Annual Return",
            "madeUpDate": company.get("arMadeUpDate"),
            "filedDate": ar_filed,
            "year": (company.get("arMadeUpDate") or "")[:4] or None,
            "note": "NAR1 作为公司关联文件挂 Company 下（scope=company，关联公司=识别出的公司名）",
        },
        "gaps": {
            "registrationNumber": "已用 BR 号填充（决策 09-01：NAR1 不印 CR 号，CSMS registrationNumber 字段映射到 BR 号；如需 CR 号须从 CI 证回填）",
            "brNumber_field": "NAR1 有 BR 号；已同步到 registrationNumber + brNumber（双字段保留以便审计）",
            "incorporationDate": "需 CI 注册证明书",
            "brExpiryDate": "需 BR 证（见 br_recognize.py 抽取）",
            "financialYearEnd": "NAR1 通常空白",
            "director_appointmentDate": "NAR1 董事任命日期常空白，缺则无法填 Company.links.appointmentDate",
            "companyType_radio": "NAR1 公司类别单选框无法从文本可靠识别，需人工确认",
        },
    }

def apply_injection(results, inject_path):
    if not inject_path or not os.path.exists(inject_path):
        return results
    with open(inject_path, encoding="utf-8") as f:
        data = json.load(f)
    injections = data if isinstance(data, list) else [data]
    for inj in injections:
        needle = inj.get("matchFileContains") or inj.get("matchFile") or ""
        matched = False
        for r in results:
            if needle and needle in r["sourceFile"]:
                for key in ("company", "companySecretary", "directors", "shareholders", "documentAssociation"):
                    if key in inj:
                        r[key] = inj[key]
                r["injectedFrom"] = "multimodal(" + needle + ")"
                r["narVersion"] = inj.get("narVersion") or r.get("narVersion", "")
                r["needsMultimodal"] = False
                matched = True
                break
        if not matched:
            print(f"  ! inject: no result matched '{needle}'", file=sys.stderr)
    return results

def main():
    args = sys.argv[1:]
    inject_path = None
    if "--inject-scan" in args:
        i = args.index("--inject-scan")
        if i + 1 < len(args):
            inject_path = args[i + 1]
            del args[i:i + 2]

    stdout_mode = "--stdout" in args
    if stdout_mode:
        args.remove("--stdout")
    files = args or ([] if stdout_mode else sorted(glob.glob("client/public/docs/*NAR1*.pdf")))
    if stdout_mode and not files:
        print(json.dumps({"count": 0, "results": [], "error": "no input file"}, ensure_ascii=False))
        return
    results = [recognize(f, render_scan=not stdout_mode) for f in files]
    if inject_path:
        results = apply_injection(results, inject_path)

    if stdout_mode:
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
        print(json.dumps({"count": len(results), "results": results}, ensure_ascii=False))
        return

    out = {"count": len(results), "results": results}
    with open("scripts/_nar1_recognized.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    for r in results:
        c = r["company"]
        tag = "scan" if r.get("scanned") else "text"
        injected = " (已注入)" if r.get("injectedFrom") else (" ⚠待注入" if r.get("needsMultimodal") else "")
        print(f"=== [{tag}]{injected} {r['sourceFile']} ({r['pages']}p, {r.get('narVersion','')}) ===")
        print(f"  公司: {c.get('name')} / {c.get('nameChinese')}")
        print(f"  注号: {c.get('registrationNumber')} ({c.get('registrationNumberSource')})")
        print(f"  AR结算日: {c.get('arMadeUpDate')}  股本: {c.get('shareCapital')}")
        print(f"  注册办: {c.get('registeredAddressRaw')}")
        print(f"  秘书: {[(s.get('nameChinese') or s.get('name')) for s in r['companySecretary']]}")
        print(f"  董事: {[(d.get('nameChinese') or d.get('name')) for d in r['directors']]}")
        print(f"  股东: {[(m.get('name') or m.get('nameChinese'), m.get('shares'), m.get('country')) for m in r['shareholders']]}")
        if r.get("needsMultimodal") and not r.get("injectedFrom"):
            print(f"  待多模态注入图片: {r.get('scanImages')}")

if __name__ == "__main__":
    main()
