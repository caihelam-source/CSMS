---
name: nar1-recognizer
description: |
  HK NAR1 (周年申報表 / Annual Return) PDF → CSMS Company/Personnel 维度识别器。
  触发：用户提供 NAR1 PDF 路径并希望识别为 CSMS 字段。
  支持 Spec 2/2025 新版（自动 regex）与 Spec 1/2014 旧版（扫描件→多模态注入）。
---

# HK NAR1 → CSMS 识别器

## 何时使用

用户提供香港公司 NAR1（周年申报表）PDF 路径，希望抽取 CSMS 维度的：
- 公司信息（英/中名、注号、AR 结算日、股本、注册办事处）
- 公司秘书、董事、股东（含持股数与属地）
- 文件关联（NAR1 作为公司关联文档）

## 前置

- `pdfplumber` 已装到 `C:/Users/Vincent/.workbuddy/binaries/python/envs/default`
- 沙箱无 tesseract OCR（旧版扫描件走多模态而非 OCR）
- agent 具备多模态读图能力（读扫描件渲染图）

## 脚本

- `scripts/nar1_recognize.py` — 主识别器
- `scripts/br_recognize.py` — BR 证识别器（独立，可选）
- `scripts/nar1_report.py` — 报告生成

## 工作流

### Step 1: 新版 NAR1 (Spec 2/2025, 2023+，有文本层)

```bash
python scripts/nar1_recognize.py "<path1.pdf>" "<path2.pdf>" ...
```

- 自动 regex 抽取：公司名/中英文/BR号/AR结算日/股本/秘书/董事/股东（含持股数与属地）
- BR 号填 `Company.registrationNumber`（NAR1 不印 CR 注册号 → 决策 09-01 用 BR 号代填）
- 输出 `scripts/_nar1_recognized.json`

### Step 2: 旧版 NAR1 (Spec 1/2014, 2014–2022 早期，纯扫描件)

脚本自动检测扫描件，渲染为 `scripts/_scan_<safe>_pN.png`，在结果标 `needsMultimodal: true`。

agent 多模态读各页图 → 提取字段 → 写 `scripts/_nar1_<year>_inject.json`：

```json
{
  "matchFileContains": "<文件名子串，用于匹配 sourceFile>",
  "narVersion": "Spec 1/2014 (scanned, YYYY-MM-DD)",
  "company": {
    "name": "...", "nameChinese": "...",
    "registrationNumber": "<CR号 from 页眉>",
    "registrationNumberSource": "CR号(旧版NAR1页眉, Spec 1/2014)",
    "type": "private_limited|public_limited|guarantee",
    "arMadeUpDate": "YYYY-MM-DD", "shareCapital": {...},
    "registeredAddressRaw": "..."
  },
  "companySecretary": [{ "entityType": "company|person", "name": "...", ... }],
  "directors": [{ "entityType": "person", "name": "...", "passport": {...}, ... }],
  "shareholders": [{ "entityType": "company|person", "name": "...", "shares": N, ... }],
  "documentAssociation": { "scope": "company", "docType": "NAR1", "year": "YYYY", ... }
}
```

然后重跑识别器合并：

```bash
python scripts/nar1_recognize.py <files> --inject-scan scripts/_nar1_<year>_inject.json
```

### Step 3: 生成报告

```bash
python scripts/nar1_report.py
```

输出 `scripts/_nar1_report.md`，含每家公司明细 + BR 证合并（若同名 BR 号一致，自动注入 brExpiryDate）+ 已知限制。

### Step 4: 交付

用 `present_files` 交付：
- `scripts/_nar1_recognized.json`（结构化数据）
- `scripts/_nar1_report.md`（Markdown 报告）
- `scripts/_scan_*.png`（旧版扫描件渲染图，可选）
- `scripts/_br_recognized.json`（BR 证数据，若有）

## CSMS 数据合约

| 维度 | 字段 | 来源 |
|---|---|---|
| Company.name | 公司英文名 | NAR1 §1 |
| Company.nameChinese | 公司中文名 | NAR1 §1 |
| Company.registrationNumber | 新版=BR号；旧版=CR号 | NAR1 新版 BR / 旧版页眉 CR |
| Company.arMadeUpDate | AR 结算日 | NAR1 §4 (新版) / §4 (旧版) |
| Company.shareCapital | {currency, issuedShares, totalAmount, paidUpAmount} | NAR1 §10/11 |
| Company.registeredAddressRaw | 注册办事处地址 | NAR1 §6 |
| Company.brExpiryDate | BR 届满日 | BR 证（独立） |
| Company.links.secretary | Company/Personnel 链接 + roles=[secretary] | NAR1 §11/12 |
| Company.links.directors | Personnel 链接 + roles=[director] | NAR1 §12/13 |
| Company.links.shareholders | Company/Personnel 链接 + roles=[shareholder] + shares + shareType | NAR1 §14 / Schedule 1 |

`documentAssociation`：NAR1 作为 scope=company 的公司关联文档，docType=NAR1，year=AR 结算日年份。

## 已知限制

- **新版 NAR1 (Spec 2/2025) 不印 CR 注册号**：已用 BR 号代填，附 `registrationNumberSource` 审计字段。如需真实 CR 号须从 CI 注册证明书回填。
- **旧版 NAR1 (Spec 1/2014) 页眉含 CR 号**：直接用 CR 号比 BR 号更准。
- **旧版扫描件需多模态注入**：沙箱无 tesseract，PDF→PNG→agent 多模态读图→写注入 JSON→`--inject-scan`。多模态比 OCR 更准（中文场景 OCR 误差大）。
- **BR 证常见扫描件**：需 `--manual` 注入或文本型自动抽。
- **公司类别单选框**：NAR1 新版不可靠（需人工确认）；旧版扫描件已通过多模态确认勾选。
- **NAR1 本身不含的字段**（标 gap，CSMS 待补）：incorporationDate（需 CI 证）、director appointmentDate、financialYearEnd（通常空白）。

## 已验证样本（14 份）

- **13 份 Spec 2/2025**（2025–2026，Bright/Chaoyang/EasyRich/HK Heyuan/HK TimeHonour/Huijun/Pannix/Ultra Nice/ZhongAn Financial/ZhongAn Great Life/ZhongAn Healthcare/ZhongAn Speedway/ZhongAn Travel）
- **1 份 Spec 1/2014**（Zhong An International Shipping 2022，扫描件，已多模态注入：CR 1670638 / 私人公司 / 法人秘书 Ahead Target (Secretaries) Limited CR 406621 / 董事 SHI Nanlu 护照 G50847472 / 股东浙江漢盛實業 780,000 股）
- **1 份 BR 证**（EasyRich 2023/04–2024/03，扫描件已注入 brExpiryDate=2024-03-31）
