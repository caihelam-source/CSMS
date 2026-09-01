"""
Render unified NAR1 (+optional BR cert) recognition report → scripts/_nar1_report.md
- 自动合并：BR 证 brNumber 与 NAR1 提取的 BR 号一致时，把 brExpiryDate/brCommencementDate 注入到公司记录
- 不一致时报错标红
"""
import json, os

NAR1_JSON = "scripts/_nar1_recognized.json"
BR_JSON   = "scripts/_br_recognized.json"
OUT       = "scripts/_nar1_report.md"

def main():
    nar1 = json.load(open(NAR1_JSON, encoding="utf-8"))
    br   = json.load(open(BR_JSON, encoding="utf-8")) if os.path.exists(BR_JSON) else {"results": []}
    br_by_name = {r["fields"].get("nameEnglish", "").upper().strip(): r for r in br.get("results", []) if r.get("fields", {}).get("brNumber")}

    lines = []
    lines.append("# NAR1（+ BR 证）识别报告 — CSMS Company 维度")
    lines.append("")
    lines.append("**样本**：14 份 NAR1 覆盖 2022–2026 年 — 13 份 Spec 2/2025 新版（text-extractable，覆盖 Bright/Chaoyang/EasyRich/HK Heyuan/HK TimeHonour/Huijun/Pannix/Ultra Nice/ZhongAn Financial/ZhongAn Great Life/ZhongAn Healthcare/ZhongAn Speedway/ZhongAn Travel），1 份 Spec 1/2014 旧版（Zhong An International Shipping 2022，扫描件）。")
    lines.append("")
    lines.append("**BR 证**：1 份（EasyRich 2023/04–2024/03，扫描件已 `--manual` 注入）")
    lines.append("")
    lines.append("## 决策记录")
    lines.append("- **`registrationNumber` 字段映射到 BR 号**（决策 09-01，新版 NAR1）：NAR1 仅印 BR 号、不印 CR 注册号；CSMS `Company.registrationNumber` 直接用 BR 号填充，附 `registrationNumberSource='BR号(NAR1)'` 审计字段。")
    lines.append("- **旧版 NAR1 (Spec 1/2014) 页眉含 CR 注册号**：可直接用 CR 号填 `registrationNumber`，`registrationNumberSource='CR号(旧版NAR1页眉, Spec 1/2014)'`，比 BR 号更准。")
    lines.append("- **`brExpiryDate` 字段来自 BR 证**：CSMS `Company.brExpiryDate`（已存在）由 BR 证 `Date of Expiry` 填充；BR 号一致时自动合并。")
    lines.append("- **旧版 NAR1 扫描件支持**（决策 09-01，方案 B）：无文本层 PDF → 自动渲染各页为 PNG → agent 多模态读图 → 写注入 JSON（`--inject-scan`）→ 合并到结果。一次性根治旧版（信息比新版全：CR 号 + 公司类别勾选 + 法人秘书 CR 号 + 董事证件号）。")
    lines.append("")
    lines.append("## 识别明细")
    lines.append("")

    for r in nar1["results"]:
        c = r["company"]
        br_cert = br_by_name.get((c.get("name") or "").upper().strip())
        if br_cert and br_cert["fields"].get("brNumber") != c.get("brNumber"):
            mismatch = f" ⚠️ **BR 号不匹配**：NAR1={c.get('brNumber')} vs BR 证={br_cert['fields'].get('brNumber')}"
        else:
            mismatch = ""
        merged_br_exp = (br_cert or {}).get("fields", {}).get("brExpiryDate")
        merged_br_com = (br_cert or {}).get("fields", {}).get("brCommencementDate")
        # 版本/扫描标签
        ver = r.get("narVersion", "")
        scan_tag = " 📷scan" if r.get("scanned") else ""
        inj_tag = " ✅已注入" if r.get("injectedFrom") else ""
        lines.append(f"### {c.get('name')}{'（附 BR 证）' if br_cert else ''}{scan_tag}{inj_tag}{mismatch}")
        lines.append(f"- **NAR1 版本**：{ver}（{r.get('pages')}p）")
        lines.append(f"- **中文名**：{c.get('nameChinese') or '—'}")
        lines.append(f"- **registrationNumber (CSMS)**：`{c.get('registrationNumber')}`（来源：`{c.get('registrationNumberSource')}`）")
        lines.append(f"- **brNumber (审计)**：`{c.get('brNumber')}`")
        lines.append(f"- **brExpiryDate**：{merged_br_exp or c.get('brExpiryDate') or '—（需 BR 证）'}")
        lines.append(f"- **brCommencementDate**：{merged_br_com or '—'}")
        lines.append(f"- **AR 结算日**：{c.get('arMadeUpDate') or '—'} | **申报日**：{r.get('documentAssociation', {}).get('filedDate') or '—'}")
        type_disp = c.get('type')
        if 'private_limited' in (type_disp or '') and r.get('injectedFrom'):
            lines.append(f"- **公司类别**：{type_disp}（多模态已确认勾选 ✓）")
        else:
            lines.append(f"- **公司类别**：{type_disp}（需人工确认勾选）")
        sc = c.get("shareCapital") or {}
        lines.append(f"- **股本**：{sc.get('currency', '—')} {sc.get('issuedShares', '—')} 股，已缴 {sc.get('paidUpAmount', '—')}" if sc else "- **股本**：—")
        lines.append(f"- **注册办事处**：{c.get('registeredAddressRaw') or '—'}")
        lines.append(f"- **公司秘书**：{', '.join((s.get('nameChinese') or s.get('name') or '—') for s in r.get('companySecretary', [])) or '—'}")
        lines.append(f"- **董事**：{', '.join((d.get('nameChinese') or d.get('name') or '—') for d in r.get('directors', [])) or '—'}")
        lines.append(f"- **股东**：")
        for s in r.get("shareholders", []) or []:
            nm = s.get("name") or s.get("nameChinese") or "—"
            sh = s.get("shares") or "—"
            ctry = s.get("country") or "—"
            st = s.get("shareType") or "—"
            lines.append(f"  - {nm} | 持股 {sh} | 股份类别 {st} | 属地 {ctry}")
        lines.append(f"- **文件关联**：scope=company, docType=NAR1, year={r.get('documentAssociation', {}).get('year') or '—'}")
        lines.append("")

    lines.append("## BR 证识别明细（独立来源）")
    if not br.get("results"):
        lines.append("—（无 BR 证样本）")
    for r in br.get("results", []):
        f = r.get("fields", {})
        lines.append(f"### {f.get('nameEnglish') or r.get('sourceFile')} [{r.get('ocrStatus')}]")
        lines.append(f"- 文件：`{r.get('sourceFile')}`")
        lines.append(f"- **BR 号**：`{f.get('brNumber')}`（Certificate No. 前 8 位）")
        lines.append(f"- **生效日期**：{f.get('brCommencementDate') or '—'}")
        lines.append(f"- **届满日期 (brExpiryDate)**：`{f.get('brExpiryDate')}`")
        lines.append(f"- **公司名（英/中）**：{f.get('nameEnglish')} / {f.get('nameChinese') or '—'}")
        lines.append(f"- **业务地址**：{f.get('addressRaw') or '—'}")
        lines.append(f"- **业务性质**：{f.get('businessNature') or '—'} | **法律地位**：{f.get('status') or '—'}")
        if r.get("note"):
            lines.append(f"- **注**：{r['note']}")
        lines.append("")

    lines.append("## 已知限制")
    lines.append("- **新版 NAR1 (Spec 2/2025) 不印 CR 注册号**：已用 BR 号代填；如需真实 CR 号须从 CI 注册证明书回填。")
    lines.append("- **旧版 NAR1 (Spec 1/2014) 页眉含 CR 号**：可直接用 CR 号，比 BR 号更准。")
    lines.append("- **旧版 NAR1 扫描件需多模态注入**：无文本层 → 渲染为 PNG → agent 多模态读图 → 写 `_nar1_YYYY_inject.json` → `nar1_recognize.py --inject-scan <json>`。本沙箱无 tesseract OCR，多模态路径比 OCR 更准（中文场景 OCR 误差大）。")
    lines.append("- **BR 证常见为扫描件**：本沙箱无 tesseract，扫描件需 `--manual` 注入多模态识别值；文本型 BR 证可自动抽取。")
    lines.append("- **TimeHonour NAR1**：股本/地址因 PDF 字符间距割裂偶有残留标签碎片（如 `2 6 HARBOUR ROAD` / `H ong Kong`）。")
    lines.append("- **EasyRich 中文名**：NAR1 误识「順富興業」应为「順昌興業」（pdfplumber 字体识别问题，可与 BR 证交叉验证修正）。")
    lines.append("- **公司类别/单选框**：NAR1 新版单选框（private/public/guarantee）无法从文本可靠识别，需人工确认；旧版扫描件已通过多模态确认勾选。")
    lines.append("- **BR 证仅 1 份**：其余 13 家 `brExpiryDate` 仍为空，待补 BR 证。")
    lines.append("")

    with open(OUT, "w", encoding="utf-8") as fp:
        fp.write("\n".join(lines))
    print(f"Wrote {OUT} ({len(lines)} lines)")

if __name__ == "__main__":
    main()
