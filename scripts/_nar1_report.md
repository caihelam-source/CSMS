# NAR1（+ BR 证）识别报告 — CSMS Company 维度

**样本**：14 份 NAR1 覆盖 2022–2026 年 — 13 份 Spec 2/2025 新版（text-extractable，覆盖 Bright/Chaoyang/EasyRich/HK Heyuan/HK TimeHonour/Huijun/Pannix/Ultra Nice/ZhongAn Financial/ZhongAn Great Life/ZhongAn Healthcare/ZhongAn Speedway/ZhongAn Travel），1 份 Spec 1/2014 旧版（Zhong An International Shipping 2022，扫描件）。

**BR 证**：1 份（EasyRich 2023/04–2024/03，扫描件已 `--manual` 注入）

## 决策记录
- **`registrationNumber` 字段映射到 BR 号**（决策 09-01，新版 NAR1）：NAR1 仅印 BR 号、不印 CR 注册号；CSMS `Company.registrationNumber` 直接用 BR 号填充，附 `registrationNumberSource='BR号(NAR1)'` 审计字段。
- **旧版 NAR1 (Spec 1/2014) 页眉含 CR 注册号**：可直接用 CR 号填 `registrationNumber`，`registrationNumberSource='CR号(旧版NAR1页眉, Spec 1/2014)'`，比 BR 号更准。
- **`brExpiryDate` 字段来自 BR 证**：CSMS `Company.brExpiryDate`（已存在）由 BR 证 `Date of Expiry` 填充；BR 号一致时自动合并。
- **旧版 NAR1 扫描件支持**（决策 09-01，方案 B）：无文本层 PDF → 自动渲染各页为 PNG → agent 多模态读图 → 写注入 JSON（`--inject-scan`）→ 合并到结果。一次性根治旧版（信息比新版全：CR 号 + 公司类别勾选 + 法人秘书 CR 号 + 董事证件号）。

## 识别明细

### Bright (Hong Kong) Hotels Management Limited
- **NAR1 版本**：Spec 2/2025 (text)（9p）
- **中文名**：伯瑞特(香港)酒店管理有限公司
- **registrationNumber (CSMS)**：`63822110`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`63822110`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2025-09-15 | **申报日**：2025-09-17
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 10000 股，已缴 10000
- **注册办事处**：ROOM 4010, 40/F., CHINA RESOURCES BUILDING, 26 HARBOUR ROAD, WANCHAI, Hong Kong
- **公司秘书**：林才賀
- **董事**：施南路
- **股东**：
  - BRIGHT HOTELS & RESORTS MANAGEMENT LIMITED | 持股 10000 | 股份类别 ordinary | 属地 British Virgin Islands
- **文件关联**：scope=company, docType=NAR1, year=2025

### Chaoyang International Trading Limited
- **NAR1 版本**：Spec 2/2025 (text)（9p）
- **中文名**：朝陽國際貿易(香港)有限公司
- **registrationNumber (CSMS)**：`63821994`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`63821994`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2025-09-15 | **申报日**：2025-09-17
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 100000 股，已缴 100000
- **注册办事处**：ROOM 4010, 40/F., CHINA RESOURCES BUILDING, 26 HARBOUR ROAD, WANCHAI, Hong Kong
- **公司秘书**：林才賀
- **董事**：施南路
- **股东**：
  - SHENG DA DEVELOPMENT LIMITED | 持股 100000 | 股份类别 ordinary | 属地 British Virgin Islands
- **文件关联**：scope=company, docType=NAR1, year=2025

### EASY RICH CORPORATION LIMITED（附 BR 证）
- **NAR1 版本**：Spec 2/2025 (text)（10p）
- **中文名**：順富興業有限公司
- **registrationNumber (CSMS)**：`65940948`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`65940948`
- **brExpiryDate**：2024-03-31
- **brCommencementDate**：2023-04-01
- **AR 结算日**：2026-04-01 | **申报日**：2026-04-08
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 1 股，已缴 1
- **注册办事处**：ROOM 4010, 40/F., CHINA RESOURCES BUILDING, 26 HARBOUR ROAD, WANCHAI, Hong Kong
- **公司秘书**：林才賀
- **董事**：施金帆, 施南路
- **股东**：
  - EASY SUCCESS INVESTMENTS LIMITED | 持股 1 | 股份类别 ordinary | 属地 British Virgin Islands
- **文件关联**：scope=company, docType=NAR1, year=2026

### Hong Kong Heyuan Group Company Limited
- **NAR1 版本**：Spec 2/2025 (text)（10p）
- **中文名**：香港禾園集團有限公司
- **registrationNumber (CSMS)**：`75409095`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`75409095`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2025-06-12 | **申报日**：2025-07-23
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 100 股，已缴 100
- **注册办事处**：ROOM 4010, 40/F., CHINA RESOURCES BUILDING, Hong Kong
- **公司秘书**：林才賀
- **董事**：施南路, 徐關興
- **股东**：
  - GOAL ACHIEVE LIMITED | 持股 100 | 股份类别 ordinary | 属地 British Virgin Islands
- **文件关联**：scope=company, docType=NAR1, year=2025

### Hong Kong Time Honour Property Limited
- **NAR1 版本**：Spec 2/2025 (text)（9p）
- **中文名**：香港時譽地産有限公司
- **registrationNumber (CSMS)**：`63822186`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`63822186`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2025-09-15 | **申报日**：2025-10-14
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 10000 股，已缴 10000
- **注册办事处**：ROOM 4010, 40/F., CHINA RESOURCES BUILDING, 2 6 HARBOUR ROAD, WANCHAI, H ong Kong
- **公司秘书**：林才賀
- **董事**：施南路
- **股东**：
  - TIME HONOUR GLOBAL LIMITED | 持股 10000 | 股份类别 ordinary | 属地 British Virgin Islands
- **文件关联**：scope=company, docType=NAR1, year=2025

### HUIJUN (INTERNATIONAL) HOLDINGS LIMITED
- **NAR1 版本**：Spec 2/2025 (text)（9p）
- **中文名**：匯駿(國際)控股有限公司
- **registrationNumber (CSMS)**：`35387857`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`35387857`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2026-03-04 | **申报日**：2026-03-16
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 100000 股，已缴 100000
- **注册办事处**：ROOM 4010, 40/F., CHINA RESOURCES BUILDING, 26 HARBOUR ROAD, WANCHAI, Hong Kong
- **公司秘书**：林才賀
- **董事**：施中安
- **股东**：
  - CHINA NEW CITY GROUP LIMITED | 持股 100000 | 股份类别 ordinary | 属地 Cayman Islands
- **文件关联**：scope=company, docType=NAR1, year=2026

### Pannix Industrial (Hong Kong) Limited
- **NAR1 版本**：Spec 2/2025 (text)（9p）
- **中文名**：佳潤實業(香港)有限公司
- **registrationNumber (CSMS)**：`63822047`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`63822047`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2025-09-15 | **申报日**：2025-09-17
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 10000 股，已缴 10000
- **注册办事处**：ROOM 4010, 40/F., CHINA RESOURCES BUILDING, 26 HARBOUR ROAD, Hong Kong
- **公司秘书**：林才賀
- **董事**：施南路
- **股东**：
  - FIRST ACHIEVER HOLDINGS LIMITED | 持股 10000 | 股份类别 ordinary | 属地 British Virgin Islands
- **文件关联**：scope=company, docType=NAR1, year=2025

### ULTRA NICE INTERNATIONAL LIMITED
- **NAR1 版本**：Spec 2/2025 (text)（10p）
- **中文名**：宏優國際有限公司
- **registrationNumber (CSMS)**：`66757916`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`66757916`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2025-10-07 | **申报日**：2025-10-14
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 1 股，已缴 1
- **注册办事处**：ROOM 4010, 40/F., CHINA RESOURCES BUILDING, Hong Kong
- **公司秘书**：林才賀
- **董事**：施金帆, 施南路
- **股东**：
  - CAPITAL YIELD GLOBAL LIMITED | 持股 1 | 股份类别 ordinary | 属地 British Virgin Islands
- **文件关联**：scope=company, docType=NAR1, year=2025

### Zhong An Financial Investment Limited
- **NAR1 版本**：Spec 2/2025 (text)（9p）
- **中文名**：眾安金融投資有限公司
- **registrationNumber (CSMS)**：`72071699`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`72071699`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2026-07-21 | **申报日**：2026-08-03
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 1 股，已缴 1
- **注册办事处**：RM 4010, 40/F CHINA, RESOURCES BLDG, Hong Kong
- **公司秘书**：林才賀
- **董事**：金建榮
- **股东**：
  - BOSS TEAM LIMITED | 持股 1 | 股份类别 ordinary | 属地 British Virgin Islands
- **文件关联**：scope=company, docType=NAR1, year=2026

### Zhong An Great Life Services Limited
- **NAR1 版本**：Spec 2/2025 (text)（10p）
- **中文名**：眾安生活服務有限公司
- **registrationNumber (CSMS)**：`72052495`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`72052495`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2026-07-14 | **申报日**：2026-08-06
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 1 股，已缴 1
- **注册办事处**：RM 4010, 40/F CHINA RESOURCES, BLDG 26 HARBOUR RD WANCHAI, Hong Kong
- **公司秘书**：林才賀
- **董事**：林才賀, 金建榮
- **股东**：
  - BRAVO KING HOLDINGS LIMITED | 持股 1 | 股份类别 ordinary | 属地 British Virgin Islands
- **文件关联**：scope=company, docType=NAR1, year=2026

### Zhong An Healthcare Limited
- **NAR1 版本**：Spec 2/2025 (text)（9p）
- **中文名**：眾安健康有限公司
- **registrationNumber (CSMS)**：`69732476`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`69732476`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2025-08-08 | **申报日**：2025-09-17
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 1 股，已缴 1
- **注册办事处**：ROOM 4010, 40/F., CHINA RESOURCES BUILDING, Hong Kong
- **公司秘书**：林才賀
- **董事**：施南路
- **股东**：
  - BEYOND HORIZON INVESTMENTS LIMITED | 持股 1 | 股份类别 ordinary | 属地 British Virgin Islands
- **文件关联**：scope=company, docType=NAR1, year=2025

### ZHONG AN INTERNATIONAL SHIPPING (HONG KONG) LIMITED 📷scan ✅已注入
- **NAR1 版本**：Spec 1/2014 (scanned, 2022-10-11)（8p）
- **中文名**：眾安國際航運(香港)有限公司
- **registrationNumber (CSMS)**：`1670638`（来源：`CR号(旧版NAR1页眉, Spec 1/2014)`）
- **brNumber (审计)**：`None`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2022-10-11 | **申报日**：2022-10-18
- **公司类别**：private_limited（多模态已确认勾选 ✓）
- **股本**：HKD 780000 股，已缴 780000.0
- **注册办事处**：ROOM 4009, 40/F, CHINA RESOURCES BUILDING, 26 HARBOUR ROAD, WANCHAI, HONG KONG
- **公司秘书**：晉標(秘書)有限公司
- **董事**：施南路
- **股东**：
  - 浙江漢盛實業有限公司 | 持股 780000 | 股份类别 ordinary | 属地 China
- **文件关联**：scope=company, docType=NAR1, year=2022

### Zhong An Speedway Limited
- **NAR1 版本**：Spec 2/2025 (text)（9p）
- **中文名**：眾安賽道有限公司
- **registrationNumber (CSMS)**：`72071665`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`72071665`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2025-07-21 | **申报日**：2025-07-30
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 1 股，已缴 1
- **注册办事处**：RM 4010, 40/F CHINA, RESOURCES BLDG, Hong Kong
- **公司秘书**：林才賀
- **董事**：金建榮
- **股东**：
  - ABUNDANT ZONE LIMITED | 持股 1 | 股份类别 ordinary | 属地 British Virgin Islands
- **文件关联**：scope=company, docType=NAR1, year=2025

### Zhong An Travel Limited
- **NAR1 版本**：Spec 2/2025 (text)（9p）
- **中文名**：眾安旅遊有限公司
- **registrationNumber (CSMS)**：`69459923`（来源：`BR号(NAR1)`）
- **brNumber (审计)**：`69459923`
- **brExpiryDate**：—（需 BR 证）
- **brCommencementDate**：—
- **AR 结算日**：2026-06-05 | **申报日**：2026-06-17
- **公司类别**：review:private_limited|public_limited|guarantee (NAR1 单选框未从文本可靠识别)（需人工确认勾选）
- **股本**：HKD 1 股，已缴 1
- **注册办事处**：ROOM 4010, 40/F., CHINA RESOURCES BUILDING, Hong Kong
- **公司秘书**：林才賀
- **董事**：施南路
- **股东**：
  - BEYOND HORIZON INVESTMENTS LIMITED | 持股 1 | 股份类别 ordinary | 属地 British Virgin Islands
- **文件关联**：scope=company, docType=NAR1, year=2026

## BR 证识别明细（独立来源）
### EASY RICH CORPORATION LIMITED [manual_injected]
- 文件：`HKOP – I1 – 2024 – Easy Rich Corporation Ltd BR (31 Mar 202 – 20230418.pdf`
- **BR 号**：`65940948`（Certificate No. 前 8 位）
- **生效日期**：2023-04-01
- **届满日期 (brExpiryDate)**：`2024-03-31`
- **公司名（英/中）**：EASY RICH CORPORATION LIMITED / 順昌興業有限公司
- **业务地址**：FLAT/RM 4010, 40/F, CHINA RESOURCES BUILDING, 26 HARBOUR ROAD, WANCHAI, HK
- **业务性质**：INVESTMENT | **法律地位**：BODY CORPORATE
- **注**：扫描件，沙箱无 OCR；值由人工/多模态识别注入

## 已知限制
- **新版 NAR1 (Spec 2/2025) 不印 CR 注册号**：已用 BR 号代填；如需真实 CR 号须从 CI 注册证明书回填。
- **旧版 NAR1 (Spec 1/2014) 页眉含 CR 号**：可直接用 CR 号，比 BR 号更准。
- **旧版 NAR1 扫描件需多模态注入**：无文本层 → 渲染为 PNG → agent 多模态读图 → 写 `_nar1_YYYY_inject.json` → `nar1_recognize.py --inject-scan <json>`。本沙箱无 tesseract OCR，多模态路径比 OCR 更准（中文场景 OCR 误差大）。
- **BR 证常见为扫描件**：本沙箱无 tesseract，扫描件需 `--manual` 注入多模态识别值；文本型 BR 证可自动抽取。
- **TimeHonour NAR1**：股本/地址因 PDF 字符间距割裂偶有残留标签碎片（如 `2 6 HARBOUR ROAD` / `H ong Kong`）。
- **EasyRich 中文名**：NAR1 误识「順富興業」应为「順昌興業」（pdfplumber 字体识别问题，可与 BR 证交叉验证修正）。
- **公司类别/单选框**：NAR1 新版单选框（private/public/guarantee）无法从文本可靠识别，需人工确认；旧版扫描件已通过多模态确认勾选。
- **BR 证仅 1 份**：其余 13 家 `brExpiryDate` 仍为空，待补 BR 证。
