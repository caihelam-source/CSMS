// Auto-converted from 业绩排期生成器_完整包/rules.js — backend-owned rule library (rules_editor 后端化)
// 请勿手改：规则库变更须在后端（rules_editor 概念）调整后重新转换导入。
// 结构：{ meta, parties, rules, offsets_midyear, offsets_annual, tasks_midyear, tasks_annual }
module.exports = {
  "meta": {
    "version": "2026-01",
    "description": "港股业绩公告规则库 — 中期 + 年度",
    "last_review": "2026-01",
    "next_review": "2026-12-31",
    "reviewer": "",
    "changelog": [
      {
        "version": "2026-01",
        "date": "2026-01-15",
        "author": "",
        "summary": "初始版本。含38条规则、24个中期偏移量、21个年度偏移量、25条中期任务、45条年度任务。",
        "changes": [
          "新建规则库，拆分自单文件HTML",
          "规则来源：上市规则13章/14A/17章、附录10、CG守则、公司条例622、HKSA/HKAS审计准则、公司章程"
        ]
      }
    ]
  },
  "parties": {
    "company_secretary": {
      "label": "公司秘书",
      "color": "#1565c0",
      "description": "负责公司秘书职能的人员/团队"
    },
    "finance": {
      "label": "财务部门",
      "color": "#2e7d32",
      "description": "负责财务、会计、报告编制"
    },
    "auditor": {
      "label": "审计师",
      "color": "#e65100",
      "description": "核数师/审计师事务所"
    },
    "registrar": {
      "label": "股份过户处",
      "color": "#7b1fa2",
      "description": "股份登记及过户代理机构"
    },
    "lawyer": {
      "label": "法律顾问",
      "color": "#00838f",
      "description": "外部律师事务所"
    },
    "printer": {
      "label": "印刷商",
      "color": "#c62828",
      "description": "财经印刷及排版翻译服务"
    },
    "internal": {
      "label": "内部",
      "color": "#455a64",
      "description": "公司内部其他部门"
    }
  },
  "party_assignments": {
    "company_secretary": "公司秘书（内部/外聘顾问）",
    "finance": "财务部门",
    "auditor": "安永会计师事务所",
    "registrar": "卓佳证券登记有限公司",
    "lawyer": "外部法律顾问（待定）",
    "printer": "财经印刷有限公司",
    "internal": "公司内部"
  },
  "rules": {
    "LR13.48": {
      "source": "上市规则 13.48",
      "text": "发行人须于财政年度/半年度结束后尽快刊发业绩公告。",
      "interpretation": "中期业绩须在T0后60天内公告，年度业绩须在T0后90天内公告。",
      "category": "时间窗口",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.48",
      "steps_default": [
        "汇编材料",
        "T1-2天定稿发送",
        "会后草拟纪要"
      ]
    },
    "LR13.46(1)": {
      "source": "上市规则 13.46(1)",
      "text": "年报须在财政年度结束后4个月内上传ESS及公司网站。",
      "interpretation": "T2 ≤ T0 + 120天。分类选 Financial Statements / ESG。",
      "category": "时间窗口",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.46(1)",
      "steps_default": [
        "确认送股东方式",
        "RH Letter定稿",
        "NRH Letter定稿",
        "嵌中英文伴送声明",
        "印刷前律师签字"
      ]
    },
    "LR13.46(2)": {
      "source": "上市规则 13.46(2)",
      "text": "中期报告须于半年度结束后3个月内上传ESS及公司网站。",
      "interpretation": "T2 ≤ T0 + 90天。分类选 Interim Report。",
      "category": "时间窗口",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.46(2)",
      "steps_default": [
        "建Checklist列出关键数字",
        "财务负责人逐数核对",
        "公司秘书复核",
        "双签确认后付印"
      ]
    },
    "LR13.49(2)": {
      "source": "上市规则 13.49(2)",
      "text": "如知悉财务表现将出现重大变化，须尽快刊发盈利警告或正面盈利预告。",
      "interpretation": "变化>20%立即起草盈警/盈喜，经律师+审计复核后刊发。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.49(2)",
      "steps_default": [
        "8/15前审阅中期损益表",
        "对比去年同期/市场预期",
        "变化>20%立即起草盈警/盈喜",
        "经律师+审计复核后刊发"
      ]
    },
    "LR13.06": {
      "source": "上市规则 13.06",
      "text": "发行人须书面通知联交所有关禁止买卖期安排。",
      "interpretation": "FF05须禁售期开始前提交，预留2个工作日给联交所。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.06"
    },
    "LR13.43": {
      "source": "上市规则 13.43",
      "text": "董事会会议日期的公告须于董事会前至少7个工作天前上载ESS及公司网站。",
      "interpretation": "T1-10=8/10或之前上载；与董事通告分开处理。",
      "category": "时间窗口",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.43",
      "steps_default": [
        "制备公告",
        "于董事会前至少7个工作天前上载ESS",
        "同步公司网站置顶"
      ]
    },
    "LR13.39(4)": {
      "source": "上市规则 13.39(4)",
      "text": "AGM后须于当晚11时前上传投票结果公告。",
      "interpretation": "T3当日23:00前；模板提前备好。",
      "category": "时间窗口",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.39(4)",
      "steps_default": [
        "提前备投票结果公告模板",
        "含退任董事重选票数/INED比例",
        "AGM结束后立即填数",
        "当晚23:00前上传"
      ]
    },
    "LR13.39": {
      "source": "上市规则 13.39",
      "text": "AGM通告须于会议前至少21天发送。",
      "interpretation": "含决议案全文+退任董事说明+委任表格截止日。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.39",
      "steps_default": [
        "AGM日期锁定后制备IF001",
        "经公司秘书签字",
        "上传ESS",
        "确认HKEX收悉"
      ]
    },
    "LR13.66(1)": {
      "source": "上市规则 13.66(1)",
      "text": "暂停股份过户登记须书面通知联交所。",
      "interpretation": "暂停前至少10个营业日通知HKEX及过户处。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.66(1)",
      "steps_default": [
        "书面通知HKEX",
        "同步通知Tricor",
        "确认回执"
      ]
    },
    "LR13.66(2)": {
      "source": "上市规则 13.66(2)",
      "text": "AGM会议记录须于会议后15天内呈交联交所。",
      "interpretation": "T3+15天内呈交；含出席名单+决议结果。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.66(2)",
      "steps_default": [
        "在日历标注T0+6个月为AGM最迟日",
        "当前T3须≤此日",
        "留4天余量防延期"
      ]
    },
    "LR13.50A": {
      "source": "上市规则 13.50A",
      "text": "如审计意见非无保留，须刊发公告说明。",
      "interpretation": "若核数师出具保留/否定/无法表示意见，立即启动应急公告。",
      "category": "披露要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.50A"
    },
    "App10A.3": {
      "source": "上市规则 附录10 A.3",
      "text": "董事禁止买卖期：业绩公告前30日内不得买卖股份。",
      "interpretation": "T1-30起至T1当日止；同步通知有关雇员。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "App10A.3",
      "steps_default": [
        "T1-30天为禁售期首日",
        "制备FF05(三家公司分别或合并)",
        "提交HKEX并抄送全体董事",
        "同步通知有关雇员",
        "IM登记册记录"
      ]
    },
    "App10FF05": {
      "source": "上市规则 附录10 FF05",
      "text": "禁止买卖期安排须以FF05表格书面通知联交所。",
      "interpretation": "禁售期开始前提交FF05；预留2个工作日处理。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "App10FF05"
    },
    "CG_C.3": {
      "source": "企业管治守则 C.3",
      "text": "审核委员会须审阅财务资料及财务报告制度。",
      "interpretation": "AC须在T1前审阅中期/年度财务资料并形成决议。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "CG_C.3",
      "steps_default": [
        "准备内控简报",
        "重点写上半年内控缺陷及整改",
        "交AC审阅",
        "纳入董事会材料"
      ]
    },
    "CG_C.3.3": {
      "source": "企业管治守则 C.3.3",
      "text": "审核委员会须与核数师讨论审计/审阅范围及结果。",
      "interpretation": "AC会议安排：T1-7天前交材料+安排会议+记录归档。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "CG_C.3.3",
      "steps_default": [
        "T1-7天前交AC材料",
        "安排AC会议",
        "形成决议",
        "记录归档"
      ]
    },
    "HKSA240": {
      "source": "HKSA 240 / 审计实务",
      "text": "核数师须设计并执行程序以识别与收入相关的舞弊风险。",
      "interpretation": "审阅/审计须覆盖收入确认、关联交易、持续经营假设。",
      "category": "审计实务",
      "last_verified": "2026-01",
      "status": "active",
      "id": "HKSA240",
      "steps_default": [
        "要求EY在T1-7天前交审阅报告",
        "核对审阅意见类型",
        "若有保留事项立即评估",
        "归档"
      ]
    },
    "HKAS570": {
      "source": "HKAS 570 / 持续经营",
      "text": "核数师须评估发行人持续经营假设是否合理。",
      "interpretation": "年度审计必做；中期审阅可选但建议覆盖重大变动。",
      "category": "审计实务",
      "last_verified": "2026-01",
      "status": "active",
      "id": "HKAS570",
      "steps_default": [
        "治理段写董事会监督气候职责",
        "战略段含气候情景分析",
        "风险段列气候相关风险",
        "指标段披范围1+2排放量"
      ]
    },
    "AuditPractice": {
      "source": "审计实务 / 核数师指引",
      "text": "核数师须有足够时间完成审计/审阅程序。",
      "interpretation": "年度T1-90进场；中期T1-50进场；视审计复杂度调整。",
      "category": "审计实务",
      "last_verified": "2026-01",
      "status": "active",
      "id": "AuditPractice",
      "steps_default": [
        "T1-50天审计进场",
        "执行分析程序+有限测试",
        "T1-7天出具审阅报告",
        "审阅报告附公告"
      ]
    },
    "Articles14": {
      "source": "公司章程 第14条",
      "text": "董事会会议通告须于会议前至少7天发送。",
      "interpretation": "中期T1-10天前；年度T1-14天前发送董事。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "Articles14",
      "steps_default": [
        "确定各公司董事会日期",
        "制备通告及议程",
        "电子邮件+书面发送",
        "确认收悉"
      ]
    },
    "Articles47": {
      "source": "公司章程 第47条",
      "text": "股份过户登记暂停须提前通知股东。",
      "interpretation": "AGM前暂停过户；年度T3-31天通知。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "Articles47",
      "steps_default": [
        "安排暂停4个工作天",
        "含AGM召开日在内",
        "全年累计不超30天",
        "通知股东"
      ]
    },
    "Articles_proxy": {
      "source": "公司章程 委任代表",
      "text": "代表委任表须于AGM前48小时提交。",
      "interpretation": "截止时间AGM前48小时；统计委任数。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "Articles_proxy"
    },
    "CO622s162": {
      "source": "公司条例 第622章 第162条",
      "text": "公司须于AGM后15天内向公司注册处提交周年申报表。",
      "interpretation": "与LR13.66(2)配合；T3+15天内呈交。",
      "category": "合规要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "CO622s162"
    },
    "LR3.13A": {
      "source": "上市规则 3.13A",
      "text": "独立非执行董事须每3年接受至少15小时培训。",
      "interpretation": "年度确认；记录归档备查。",
      "category": "董事合规",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR3.13A"
    },
    "LR3.13B": {
      "source": "上市规则 3.13B",
      "text": "INED任职满9年须额外披露。",
      "interpretation": "CG报告披露过渡安排；律师审阅。",
      "category": "董事合规",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR3.13B"
    },
    "LR3.13C": {
      "source": "上市规则 3.13C",
      "text": "INED兼任HK上市公司董事不得超过6家。",
      "interpretation": "年度统计；CG报告披露。",
      "category": "董事合规",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR3.13C"
    },
    "CG_C.1.1": {
      "source": "企业管治守则 C.1.1",
      "text": "董事会须维持技能矩阵。",
      "interpretation": "年度更新技能矩阵；律师审阅后入年报CG段。",
      "category": "董事合规",
      "last_verified": "2026-01",
      "status": "active",
      "id": "CG_C.1.1"
    },
    "CG_C.2.3": {
      "source": "企业管治守则 C.2.3",
      "text": "提名委员会须评估董事会多元化政策。",
      "interpretation": "年度进度披露；统计性别/年龄/技能分布。",
      "category": "董事合规",
      "last_verified": "2026-01",
      "status": "active",
      "id": "CG_C.2.3"
    },
    "LR14A": {
      "source": "上市规则 14A",
      "text": "关连交易须遵守披露及股东批准规定。",
      "interpretation": "持续关连交易年度清查；超额须立即披露。",
      "category": "披露要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR14A"
    },
    "ESGClimate": {
      "source": "ESG指引 / 气候披露",
      "text": "发行人须披露气候相关风险及温室气体排放。",
      "interpretation": "含气候四支柱+范围1+2排放量；律师审阅。",
      "category": "披露要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "ESGClimate"
    },
    "LR13.68": {
      "source": "上市规则 13.68",
      "text": "发行人须于财政年度结束后6个月内举行AGM。",
      "interpretation": "T3 ≤ T0+6个月；留4天余量防延期。",
      "category": "时间窗口",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.68"
    },
    "LR13.36": {
      "source": "上市规则 13.36",
      "text": "发行人须于AGM前至少21天向股东发送通函。",
      "interpretation": "含决议案全文+退任董事重选说明。",
      "category": "程序要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "LR13.36"
    },
    "HKAS210": {
      "source": "HKAS 210 / 业务约定条款",
      "text": "核数师须就审计/审阅范围与管理层达成一致。",
      "interpretation": "T1-90进场时即确认审计范围+关键审计事项。",
      "category": "审计实务",
      "last_verified": "2026-01",
      "status": "active",
      "id": "HKAS210"
    },
    "HKAS315": {
      "source": "HKAS 315 / 了解实体及其环境",
      "text": "核数师须了解被审计单位及其环境以识别和评估重大错报风险。",
      "interpretation": "进场阶段完成；含舞弊风险评估。",
      "category": "审计实务",
      "last_verified": "2026-01",
      "status": "active",
      "id": "HKAS315"
    },
    "HKAS330": {
      "source": "HKAS 330 / 应对评估的重大错报风险",
      "text": "核数师须针对评估的重大错报风险设计和实施进一步审计程序。",
      "interpretation": "底稿阶段完成；含实质性程序+控制测试。",
      "category": "审计实务",
      "last_verified": "2026-01",
      "status": "active",
      "id": "HKAS330"
    },
    "HKSA700": {
      "source": "HKSA 700 / 形成审计意见",
      "text": "核数师须基于审计证据形成审计意见。",
      "interpretation": "审计报告初稿T1-17天前完成；经理→合伙人两级复核。",
      "category": "审计实务",
      "last_verified": "2026-01",
      "status": "active",
      "id": "HKSA700"
    },
    "HKSA705": {
      "source": "HKSA 705 / 审计意见类型",
      "text": "核数师须就审计意见类型与管理层沟通。",
      "interpretation": "无保留/保留/否定/无法表示；非无保留立即启动13.50A。",
      "category": "审计实务",
      "last_verified": "2026-01",
      "status": "active",
      "id": "HKSA705"
    },
    "HKSA706": {
      "source": "HKSA 706 / 强调事项段",
      "text": "核数师可考虑在审计报告中增加强调事项段。",
      "interpretation": "持续经营段/重大不确定性提示；MD&A须对应。",
      "category": "审计实务",
      "last_verified": "2026-01",
      "status": "active",
      "id": "HKSA706"
    },
    "BuybackCode": {
      "source": "回购守则",
      "text": "回购静默期：业绩公告前1个月起不得回购股份。",
      "interpretation": "检查现有回购授权余额；通知有关雇员。",
      "category": "合规要求",
      "last_verified": "2026-01",
      "status": "active",
      "id": "BuybackCode"
    }
  },
  "offsets_midyear": [
    {
      "id": "MY_blackout",
      "name": "禁售期启动",
      "anchor": "T1",
      "days": -30,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "App10A.3"
    },
    {
      "id": "MY_ff05",
      "name": "FF05报备",
      "anchor": "T1",
      "days": -32,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "App10FF05"
    },
    {
      "id": "MY_profit_warning",
      "name": "盈警/盈喜判断截止",
      "anchor": "T1",
      "days": -5,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.49(2)"
    },
    {
      "id": "MY_audit_start",
      "name": "审计进场",
      "anchor": "T1",
      "days": -50,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "AuditPractice"
    },
    {
      "id": "MY_review_done",
      "name": "审阅程序完成",
      "anchor": "T1",
      "days": -10,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "HKSA240"
    },
    {
      "id": "MY_review_report",
      "name": "审阅报告出具",
      "anchor": "T1",
      "days": -7,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "HKSA240"
    },
    {
      "id": "MY_ac_materials",
      "name": "AC会议材料",
      "anchor": "T1",
      "days": -7,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "CG_C.3.3"
    },
    {
      "id": "MY_board_notice",
      "name": "董事会议程传送",
      "anchor": "T1",
      "days": -10,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "Articles14"
    },
    {
      "id": "MY_board_announce",
      "name": "董事会日期公告",
      "anchor": "T1",
      "days": -10,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.43"
    },
    {
      "id": "MY_internal_control",
      "name": "内控简报",
      "anchor": "T1",
      "days": -9,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "CG_C.3"
    },
    {
      "id": "MY_board_materials",
      "name": "董事会材料定稿",
      "anchor": "T1",
      "days": -2,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.48"
    },
    {
      "id": "MY_report_draft",
      "name": "中期报告框架传阅",
      "anchor": "T1",
      "days": -14,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.46(2)"
    },
    {
      "id": "MY_mda_done",
      "name": "MD&A定稿",
      "anchor": "T1",
      "days": -5,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "HKAS570"
    },
    {
      "id": "MY_submit_printer",
      "name": "提交印刷商排版翻译",
      "anchor": "T1",
      "days": -20,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "AuditPractice"
    },
    {
      "id": "MY_confirm_qty",
      "name": "确认印数",
      "anchor": "T1",
      "days": 19,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "AuditPractice"
    },
    {
      "id": "MY_ir_cover",
      "name": "IR封面预印交付",
      "anchor": "T2",
      "days": -8,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.46(2)"
    },
    {
      "id": "MY_ec_letters",
      "name": "E&C信函定稿",
      "anchor": "T2",
      "days": -8,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.46(2)"
    },
    {
      "id": "MY_letters_registrar",
      "name": "信函交付过户处",
      "anchor": "T2",
      "days": -5,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.46(2)"
    },
    {
      "id": "MY_report_final",
      "name": "★中期报告正文定稿",
      "anchor": "T2",
      "days": -5,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.46(2)"
    },
    {
      "id": "MY_report_print",
      "name": "中报付印",
      "anchor": "T2",
      "days": -5,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.46(2)"
    },
    {
      "id": "MY_ir_registrar",
      "name": "IR交付过户处",
      "anchor": "T2",
      "days": -1,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.46(2)"
    },
    {
      "id": "MY_upload_ess",
      "name": "★中期报告上传ESS",
      "anchor": "T2",
      "days": 0,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.46(2)"
    },
    {
      "id": "MY_despatch",
      "name": "寄发日(Despatch)",
      "anchor": "T2",
      "days": 1,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.46(2)"
    },
    {
      "id": "MY_dividend",
      "name": "派发股息支票(如有)",
      "anchor": "T2",
      "days": 8,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.48"
    }
  ],
  "offsets_annual": [
    {
      "id": "AN_blackout",
      "name": "禁售期启动",
      "anchor": "T1",
      "days": -60,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "App10A.3"
    },
    {
      "id": "AN_ff05",
      "name": "FF05报备",
      "anchor": "T1",
      "days": -62,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.06"
    },
    {
      "id": "AN_profit_warning",
      "name": "盈警/盈喜判断截止",
      "anchor": "T1",
      "days": -7,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.49(2)"
    },
    {
      "id": "AN_audit_start",
      "name": "审计进场",
      "anchor": "T1",
      "days": -90,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "AuditPractice"
    },
    {
      "id": "AN_audit_workpapers",
      "name": "审计底稿完成",
      "anchor": "T1",
      "days": -20,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "AuditPractice"
    },
    {
      "id": "AN_audit_draft",
      "name": "审计初稿",
      "anchor": "T1",
      "days": -17,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "AuditPractice"
    },
    {
      "id": "AN_mda_done",
      "name": "MD&A定稿",
      "anchor": "T1",
      "days": -7,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "HKAS570"
    },
    {
      "id": "AN_board_notice",
      "name": "董事会议程传送",
      "anchor": "T1",
      "days": -14,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "Articles14"
    },
    {
      "id": "AN_ac_materials",
      "name": "审核委材料",
      "anchor": "T1",
      "days": -7,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "CG_C.3.3"
    },
    {
      "id": "AN_internal_control",
      "name": "内控报告",
      "anchor": "T1",
      "days": -9,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "CG_C.3"
    },
    {
      "id": "AN_auditor_letter",
      "name": "核数师函件",
      "anchor": "T1",
      "days": -6,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "CG_C.3.3"
    },
    {
      "id": "AN_board_materials",
      "name": "董事会材料定稿",
      "anchor": "T1",
      "days": -2,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.48"
    },
    {
      "id": "AN_report_print",
      "name": "年报付印",
      "anchor": "T2",
      "days": -3,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.46(1)"
    },
    {
      "id": "AN_rh_nrh",
      "name": "RH/NRH定稿",
      "anchor": "T2",
      "days": -5,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.46(1)"
    },
    {
      "id": "AN_upload_ess",
      "name": "★年报上传ESS",
      "anchor": "T2",
      "days": 0,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.46(1)"
    },
    {
      "id": "AN_suspend_notice",
      "name": "暂停过户通知",
      "anchor": "T3",
      "days": -31,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.66(1)"
    },
    {
      "id": "AN_suspend_start",
      "name": "暂停过户开始",
      "anchor": "T3",
      "days": -6,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "Articles47"
    },
    {
      "id": "AN_proxy_deadline",
      "name": "代表委任表截止",
      "anchor": "T3",
      "days": -2,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "Articles_proxy"
    },
    {
      "id": "AN_if001",
      "name": "IF001提交",
      "anchor": "T3",
      "days": -25,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.39"
    },
    {
      "id": "AN_vote_upload",
      "name": "投票结果上传",
      "anchor": "T3",
      "days": 0,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.39(4)"
    },
    {
      "id": "AN_agm_record",
      "name": "AGM记录呈交",
      "anchor": "T3",
      "days": 15,
      "last_verified": "2026-01",
      "status": "active",
      "rule_code": "LR13.66(2)"
    }
  ],
  "tasks_midyear": [
    {
      "id": "blackout_task",
      "category": "中期业绩",
      "name": "禁止买卖期启动+FF05通知HKEX",
      "details": [
        "T1-30天为禁售期首日",
        "制备FF05(三家公司分别或合并)",
        "提交HKEX并抄送全体董事",
        "同步通知有关雇员",
        "IM登记册记录"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "MY_blackout",
      "end_offset_id": "MY_profit_warning"
    },
    {
      "id": "ff05_filing",
      "category": "中期业绩",
      "name": "Ff05表格制备与报备HKEX",
      "details": [
        "制备Ff05表格(三家公司分别或合并)",
        "提交HKEX并抄送全体董事",
        "预留2个工作日处理"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "point",
      "offset_id": "MY_ff05"
    },
    {
      "id": "profit_warning_task",
      "category": "中期业绩",
      "name": "监察是否须发出盈警/盈喜公告",
      "details": [
        "8/15前审阅中期损益表",
        "对比去年同期/市场预期",
        "变化>20%立即起草盈警/盈喜",
        "经律师+审计复核后刊发"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_profit_warning",
      "type": "point"
    },
    {
      "id": "review_task",
      "category": "中期业绩",
      "name": "中期审阅（进场→程序→审阅报告）",
      "details": [
        "T1-50天审计进场",
        "执行分析程序+有限测试",
        "T1-7天出具审阅报告",
        "审阅报告附公告"
      ],
      "party": "auditor",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "MY_audit_start",
      "end_offset_id": "MY_review_report"
    },
    {
      "id": "review_letter_task",
      "category": "中期业绩",
      "name": "核数师《中期审阅情况说明》+意见类型跟踪",
      "details": [
        "要求EY在T1-7天前交审阅报告",
        "核对审阅意见类型",
        "若有保留事项立即评估",
        "归档"
      ],
      "party": "finance",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_review_report",
      "type": "point"
    },
    {
      "id": "mda_task",
      "category": "中期业绩",
      "name": "管理层讨论及分析(MD&A)+持续经营段",
      "details": [
        "基于审阅后数字起草MD&A",
        "简明持续经营段",
        "解释重大变动(>10%)",
        "中英文双语"
      ],
      "party": "finance",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "MY_review_done",
      "end_offset_id": "MY_mda_done"
    },
    {
      "id": "signoff_task",
      "category": "中期业绩",
      "name": "中期业绩vs中期报告数据一致性核对（双签）",
      "details": [
        "建Checklist列出关键数字",
        "财务负责人逐数核对",
        "公司秘书复核",
        "双签确认后付印"
      ],
      "party": "finance",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_report_draft",
      "type": "point"
    },
    {
      "id": "im_register_task",
      "category": "中期业绩",
      "name": "内幕消息登记册(IM Register)更新",
      "details": [
        "禁售期通知",
        "董事沟通记录",
        "盈警判断过程",
        "统一入IM登记册按月归档"
      ],
      "party": "company_secretary",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "MY_blackout",
      "end_offset_id": "MY_upload_ess"
    },
    {
      "id": "buyback_task",
      "category": "中期业绩",
      "name": "回购静默期冲突检查",
      "details": [
        "确认各公司是否有回购授权",
        "T1前1个月起禁回购",
        "检查现有授权余额",
        "通知有关雇员"
      ],
      "party": "company_secretary",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_blackout",
      "type": "point"
    },
    {
      "id": "ac_meeting_task",
      "category": "审核委员会",
      "name": "审核委员会审阅中期财务资料（AC会议）",
      "details": [
        "T1-7天前交AC材料",
        "安排AC会议",
        "形成决议",
        "记录归档"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "MY_ac_materials",
      "end_offset_id": "MY_ac_materials"
    },
    {
      "id": "ac_auditor_task",
      "category": "审核委员会",
      "name": "AC与核数师中期会议",
      "details": [
        "安排会议",
        "讨论审阅发现/调整事项/持续经营",
        "记录会议纪要",
        "归档"
      ],
      "party": "auditor",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_ac_materials",
      "type": "point"
    },
    {
      "id": "board_notice_task",
      "category": "董事会",
      "name": "董事会议程传送+通告发出(≥10天)",
      "details": [
        "确定各公司董事会日期",
        "制备通告及议程",
        "电子邮件+书面发送",
        "确认收悉"
      ],
      "party": "company_secretary",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_board_notice",
      "type": "point"
    },
    {
      "id": "internal_ctrl_task",
      "category": "董事会",
      "name": "内控简报提交AC/董事会",
      "details": [
        "准备内控简报",
        "重点写上半年内控缺陷及整改",
        "交AC审阅",
        "纳入董事会材料"
      ],
      "party": "internal",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_internal_control",
      "type": "point"
    },
    {
      "id": "board_materials_task",
      "category": "董事会",
      "name": "收集及传阅董事会材料+草拟会议纪要",
      "details": [
        "汇编材料",
        "T1-2天定稿发送",
        "会后草拟纪要"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "MY_board_materials",
      "end_offset_id": "MY_board_materials"
    },
    {
      "id": "board_announce_task",
      "category": "董事会",
      "name": "董事会会议日期公告上载ESS",
      "details": [
        "制备公告",
        "于董事会前至少7个工作天前上载ESS",
        "同步公司网站置顶"
      ],
      "party": "company_secretary",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_board_announce",
      "type": "point"
    },
    {
      "id": "report_draft_task",
      "category": "中期报告",
      "name": "中期报告框架传阅+各方协调",
      "details": [
        "制备中报框架",
        "传阅EY/印刷商/律师",
        "协调时间节点"
      ],
      "party": "company_secretary",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "MY_submit_printer",
      "end_offset_id": "MY_report_draft"
    },
    {
      "id": "submit_printer_task",
      "category": "中期报告",
      "name": "提交中期报告及业绩公告予印刷商翻译及排版",
      "details": [
        "汇总中报全文",
        "交付印刷商",
        "确认排版翻译时间表",
        "追踪进度"
      ],
      "party": "company_secretary",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_submit_printer",
      "type": "point"
    },
    {
      "id": "ir_cover_task",
      "category": "中期报告",
      "name": "IR封面预印交付印刷商",
      "details": [
        "统计三家公司中报印刷总量",
        "交付印刷商",
        "确认纸张/装订规格",
        "取得回执"
      ],
      "party": "printer",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_ir_cover",
      "type": "point"
    },
    {
      "id": "ec_letters_task",
      "category": "中期报告",
      "name": "E&C信函定稿（律师签署）",
      "details": [
        "律师制备E&C Letters",
        "sign off",
        "归档"
      ],
      "party": "lawyer",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_ec_letters",
      "type": "point"
    },
    {
      "id": "letters_reg_task",
      "category": "中期报告",
      "name": "信函交付股份过户处",
      "details": [
        "将E&C Letters交付Tricor",
        "取得签收",
        "确认邮寄安排"
      ],
      "party": "registrar",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_letters_registrar",
      "type": "point"
    },
    {
      "id": "report_final_task",
      "category": "中期报告",
      "name": "★中期报告正文定稿（律师E&C签署）",
      "details": [
        "律师E&C审阅中报正文",
        "sign off",
        "中英文双语",
        "这是最关键节点"
      ],
      "party": "lawyer",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_report_final",
      "type": "point"
    },
    {
      "id": "report_print_task",
      "category": "中期报告",
      "name": "《中期报告》付印",
      "details": [
        "正文定稿后即交印刷商",
        "印刷商同步付印",
        "预留5天",
        "T2上传"
      ],
      "party": "printer",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "MY_report_final",
      "end_offset_id": "MY_upload_ess"
    },
    {
      "id": "confirm_qty_task",
      "category": "中期报告",
      "name": "与印刷商确认中期报告印数",
      "details": [
        "统计总印数",
        "与印刷商确认",
        "含英文版/存档本数量",
        "下达付印指令"
      ],
      "party": "printer",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_confirm_qty",
      "type": "point"
    },
    {
      "id": "upload_ess_task",
      "category": "中期报告",
      "name": "上传中期报告至HKEX(ESS)+公司网站",
      "details": [
        "通知印刷商收盘后上传",
        "分类选Interim Report",
        "同步公司网站置顶"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_upload_ess",
      "type": "point"
    },
    {
      "id": "print_confirm_task",
      "category": "中期报告",
      "name": "中报付印执行与进度跟踪",
      "details": [
        "正文定稿后向印刷商下达付印指令",
        "跟踪印刷商印制进度",
        "确认印数与质量",
        "安排物流送交HKEX/过户处"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "point",
      "offset_id": "MY_report_print"
    },
    {
      "id": "ir_registrar_task",
      "category": "中期报告",
      "name": "IR交付过户处 + 股东名册更新",
      "details": [
        "准备股东名册过户处登记文件",
        "向香港中央结算及过户处递交中期报告",
        "更新公司网站IR栏目",
        "同步发送主要机构投资者"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "point",
      "offset_id": "MY_ir_registrar"
    },
    {
      "id": "despatch_task",
      "category": "中期报告",
      "name": "寄发日(Despatch) — 向股东寄发中报",
      "details": [
        "核对股东名册收件地址",
        "安排印刷商/邮寄服务寄发中期报告",
        "符合上市规则13.46(2)寄发时限",
        "保留寄发证明(POD)"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "point",
      "offset_id": "MY_despatch"
    },
    {
      "id": "cct_task",
      "category": "中期报告",
      "name": "关连交易中期清查",
      "details": [
        "更新关连方清单",
        "统计上半年CCT实际金额",
        "与年度额度对照",
        "超额须立即披露"
      ],
      "party": "auditor",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "MY_audit_start",
      "end_offset_id": "MY_upload_ess"
    },
    {
      "id": "dividend_task",
      "category": "中期报告",
      "name": "派发股息支票(如有)",
      "details": [
        "董事会授权派发股息",
        "确认派息银行户口",
        "寄发股息支票",
        "登记派息记录"
      ],
      "party": "company_secretary",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "MY_dividend",
      "type": "point"
    }
  ],
  "tasks_annual": [
    {
      "id": "blackout_task",
      "category": "业绩公告",
      "name": "禁止买卖期启动+FF05通知HKEX",
      "details": [
        "T1-60天为禁售期首日",
        "制备FF05表格",
        "提交HKEX并抄送全体董事",
        "同步通知有关雇员",
        "IM登记册记录"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "AN_blackout",
      "end_offset_id": "AN_profit_warning"
    },
    {
      "id": "ff05_filing",
      "category": "业绩公告",
      "name": "Ff05表格制备与报备HKEX",
      "details": [
        "制备Ff05表格",
        "提交HKEX并抄送全体董事",
        "预留2个工作日处理"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "point",
      "offset_id": "AN_ff05"
    },
    {
      "id": "audit_workpapers_task",
      "category": "业绩公告",
      "name": "审计底稿完成确认",
      "details": [
        "核数师完成全部审计底稿编制",
        "关键审计事项(KAM)沟通备忘录定稿",
        "管理当局声明书(MoR)签署",
        "底稿归档备查"
      ],
      "party": "auditor",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "point",
      "offset_id": "AN_audit_workpapers"
    },
    {
      "id": "profit_warning_task",
      "category": "业绩公告",
      "name": "监察是否须发出盈警/盈喜公告",
      "details": [
        "取得审计初稿后立即审阅损益表",
        "对比去年同期识别重大变化",
        "如变化>20%立即起草",
        "经律师+审计复核后刊发"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_profit_warning",
      "type": "point"
    },
    {
      "id": "audit_task",
      "category": "业绩公告",
      "name": "审计报告初稿（进场→底稿→定稿）",
      "details": [
        "T1-90天审计进场",
        "T1-70天沟通关键审计事项",
        "T1-20天底稿完成",
        "T1-17天初稿交秘书",
        "经理→合伙人两级复核"
      ],
      "party": "auditor",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "AN_audit_start",
      "end_offset_id": "AN_audit_draft"
    },
    {
      "id": "auditor_letter_task",
      "category": "业绩公告",
      "name": "核数师《审核情况说明函件》+意见类型跟踪",
      "details": [
        "要求EY在T1-6天前交函件",
        "核对审计意见类型",
        "若非无保留立即启动13.50A应急公告",
        "函件归档备查"
      ],
      "party": "finance",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_auditor_letter",
      "type": "point"
    },
    {
      "id": "mda_task",
      "category": "业绩公告",
      "name": "管理层讨论及分析(MD&A)+持续经营单独段",
      "details": [
        "基于审计初稿起草MD&A",
        "单独一段写持续经营假设",
        "股息政策执行说明",
        "投资物业及主要物业盘点",
        "中英文双语"
      ],
      "party": "finance",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "AN_audit_draft",
      "end_offset_id": "AN_mda_done"
    },
    {
      "id": "signoff_task",
      "category": "业绩公告",
      "name": "业绩公告vs年报数据一致性逐数核对（双签）",
      "details": [
        "建Sign-off Checklist",
        "财务负责人逐数核对",
        "公司秘书复核",
        "双签确认后付印"
      ],
      "party": "finance",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_audit_draft",
      "type": "point"
    },
    {
      "id": "im_register_task",
      "category": "业绩公告",
      "name": "内幕消息登记册(IM Register)更新",
      "details": [
        "禁售期启动通知",
        "董事/雇员沟通记录",
        "业绩框架传阅记录",
        "盈警判断过程",
        "统一入IM登记册"
      ],
      "party": "company_secretary",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "AN_blackout",
      "end_offset_id": "AN_upload_ess"
    },
    {
      "id": "buyback_task",
      "category": "业绩公告",
      "name": "回购静默期冲突检查+有关雇员政策通知",
      "details": [
        "确认公司是否有回购授权",
        "若有T1前1个月起禁回购",
        "通知有关雇员禁售",
        "检查现有书面政策"
      ],
      "party": "company_secretary",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_blackout",
      "type": "point"
    },
    {
      "id": "ined_training",
      "category": "董事合规",
      "name": "收集董事培训记录+制备确认书",
      "details": [
        "向各董事发函收集培训证明",
        "汇总培训主题/时数/提供方",
        "制备确认书由董事签署",
        "律师审阅"
      ],
      "party": "lawyer",
      "priority": "低优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "ined_independence",
      "category": "董事合规",
      "name": "INED独立性年度确认函",
      "details": [
        "向每名INED发独立性确认函",
        "列明7项独立性因素逐一确认",
        "董事签署",
        "律师审阅"
      ],
      "party": "lawyer",
      "priority": "低优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "std_covenant",
      "category": "董事合规",
      "name": "董事年度确认遵守标准守则+简历更新",
      "details": [
        "制备标准守则遵守确认书",
        "请董事确认年内无违规",
        "同步更新董事简历",
        "双签归档"
      ],
      "party": "lawyer",
      "priority": "低优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_board_notice",
      "type": "point"
    },
    {
      "id": "ined_9yr",
      "category": "董事合规",
      "name": "INED连续任职≥9年声明",
      "details": [
        "核对每名INED累计任职年限",
        "若≥9年制备额外声明",
        "CG报告披露过渡安排",
        "律师审阅"
      ],
      "party": "lawyer",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "ined_seats",
      "category": "董事合规",
      "name": "INED兼任HK上市公司≤6家声明",
      "details": [
        "统计每名INED现任HK上市公司董事席位数",
        "若≥6家制备声明",
        "CG报告披露"
      ],
      "party": "lawyer",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "skills_matrix",
      "category": "董事合规",
      "name": "编制并披露董事会技能矩阵",
      "details": [
        "列出每名董事核心技能标签",
        "汇总为技能矩阵表",
        "说明技能组合如何符合公司策略"
      ],
      "party": "lawyer",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "nomination_review",
      "category": "董事合规",
      "name": "提名委员会年度时间投入与贡献评估结论",
      "details": [
        "收集每名董事年内出席记录",
        "提名委会议讨论评估",
        "形成评估结论",
        "CG报告披露"
      ],
      "party": "company_secretary",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "diversity",
      "category": "董事合规",
      "name": "董事会多元化政策年度进度披露",
      "details": [
        "审视现有多元化政策",
        "统计性别/年龄/技能分布",
        "对照目标写进度说明",
        "CG报告披露"
      ],
      "party": "lawyer",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "attendance",
      "category": "董事合规",
      "name": "董事出席率计算表",
      "details": [
        "从会议记录提取每名董事出席",
        "计算出席率",
        "汇总为表格",
        "律师审阅后入年报CG段"
      ],
      "party": "company_secretary",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "committee_records",
      "category": "董事合规",
      "name": "薪酬/提名/审核委员会开会记录收集",
      "details": [
        "收集各委员会年内所有会议记录",
        "核对召开次数达标",
        "审核委确认含无管理层在场见核数师会议"
      ],
      "party": "company_secretary",
      "priority": "低优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_internal_control",
      "type": "point"
    },
    {
      "id": "board_notice_task",
      "category": "董事会",
      "name": "董事会议程传送+通告发出(≥14天)",
      "details": [
        "确定董事会日期后计算14天前",
        "制备会议通告及议程",
        "电子邮件+书面双轨发送",
        "确认收悉"
      ],
      "party": "company_secretary",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_board_notice",
      "type": "point"
    },
    {
      "id": "ac_materials_task",
      "category": "董事会",
      "name": "审计师提交审核委员会材料",
      "details": [
        "T1-7天前要求审计师提交审核委专属材料",
        "含关键审计事项/持续经营/核数费用",
        "安排审核委会议"
      ],
      "party": "auditor",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "internal_ctrl_task",
      "category": "董事会",
      "name": "内控部门提交年度内控报告",
      "details": [
        "T1-9天前通知内审部门准备",
        "提前一周交审核委审阅",
        "收集审核委意见",
        "修改后入董事会材料"
      ],
      "party": "internal",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_internal_control",
      "type": "point"
    },
    {
      "id": "board_materials_full",
      "category": "董事会",
      "name": "收集及传阅董事会材料+草拟会议纪要",
      "details": [
        "汇编7模块材料",
        "T1-2天定稿发送",
        "会后草拟会议纪要"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_board_materials",
      "type": "point"
    },
    {
      "id": "esg_report",
      "category": "年报ESG",
      "name": "ESG报告(含气候四支柱+范围1+2)",
      "details": [
        "治理段写董事会监督气候职责",
        "战略段含气候情景分析",
        "风险段列气候相关风险",
        "指标段披范围1+2排放量"
      ],
      "party": "lawyer",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_mda_done",
      "type": "point"
    },
    {
      "id": "chairman_report",
      "category": "年报ESG",
      "name": "主席报告",
      "details": [
        "起草主席致辞",
        "与MD&A口径核对",
        "律师审阅",
        "主席签署"
      ],
      "party": "internal",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_board_materials",
      "type": "point"
    },
    {
      "id": "cg_report",
      "category": "年报ESG",
      "name": "企业管治报告(CG)含技能表/多元化/INED声明",
      "details": [
        "汇编技能矩阵+多元化进度+INED声明+出席率+委员会记录",
        "律师审阅",
        "入年报"
      ],
      "party": "company_secretary",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "director_profiles",
      "category": "年报ESG",
      "name": "董事及高级管理层履历(C07/C08)",
      "details": [
        "向各董事更新履历",
        "加技能标签+兼任家数",
        "律师审阅",
        "双签"
      ],
      "party": "lawyer",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_board_materials",
      "type": "point"
    },
    {
      "id": "board_report",
      "category": "年报ESG",
      "name": "董事会报告",
      "details": [
        "起草业务回顾",
        "列主要风险及应对",
        "股息建议",
        "资本结构说明",
        "律师审阅"
      ],
      "party": "lawyer",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_board_materials",
      "type": "point"
    },
    {
      "id": "share_scheme",
      "category": "年报ESG",
      "name": "股份计划5项限额披露核对",
      "details": [
        "核对购股权计划/股份奖励计划",
        "授出期权归属期是否合规",
        "奖励可发行股数≤上限"
      ],
      "party": "lawyer",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "uop",
      "category": "年报ESG",
      "name": "募集资金用途(UOP)往期结转明细",
      "details": [
        "列出所有历史募集资金项目",
        "结转余额",
        "当年实际使用金额",
        "差异说明",
        "核数师确认"
      ],
      "party": "auditor",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "5pct_invest",
      "category": "年报ESG",
      "name": "重大投资>5%总资产：持股数量+百分比+风控",
      "details": [
        "列出所有>5%总资产的投资",
        "披持股数量",
        "投资组合明细",
        "风控机制说明"
      ],
      "party": "finance",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "treasury_shares",
      "category": "年报ESG",
      "name": "库存股份拟定用途声明",
      "details": [
        "核查公司是否有库存股份",
        "若有说明拟定用途",
        "若无声明'本公司无库存股份'",
        "律师审阅"
      ],
      "party": "lawyer",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_ac_materials",
      "type": "point"
    },
    {
      "id": "rh_nrh_task",
      "category": "年报ESG",
      "name": "年报中英文伴送声明+RH/NRH Letter措辞",
      "details": [
        "确认送股东方式",
        "RH Letter定稿",
        "NRH Letter定稿",
        "嵌中英文伴送声明",
        "印刷前律师签字"
      ],
      "party": "company_secretary",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_rh_nrh",
      "type": "point"
    },
    {
      "id": "report_final_task",
      "category": "年报ESG",
      "name": "《年报》最后定稿+大量付印",
      "details": [
        "T2-3天前全部材料定稿",
        "交印刷商",
        "预留3个工作日印刷",
        "T2当日上传ESS",
        "同步公司网站"
      ],
      "party": "printer",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_report_print",
      "type": "point"
    },
    {
      "id": "upload_ess_annual",
      "category": "年报ESG",
      "name": "上传年报/ESG/RH/NRH Letter至HKEX(ESS)+公司网站",
      "details": [
        "通知印刷商上传",
        "年报→Financial Statements",
        "ESG→同路径",
        "RH→Circulars-[Other]",
        "公司网站同步置顶"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_upload_ess",
      "type": "point"
    },
    {
      "id": "cct_annual",
      "category": "年报ESG",
      "name": "关连交易年度清查(CCT额度执行对照)",
      "details": [
        "年末关连方清单更新",
        "持续关连交易实际金额统计",
        "与年报批准的年度额度对照",
        "超额须立即披露"
      ],
      "party": "auditor",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_audit_start",
      "type": "point"
    },
    {
      "id": "suspend_notice_task",
      "category": "AGM",
      "name": "暂停股份过户登记通知HKEX及过户处",
      "details": [
        "书面通知HKEX",
        "同步通知Tricor",
        "确认回执"
      ],
      "party": "registrar",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_suspend_notice",
      "type": "point"
    },
    {
      "id": "suspend_start_task",
      "category": "AGM",
      "name": "暂停股份过户登记办理",
      "details": [
        "安排暂停4个工作天",
        "含AGM召开日在内",
        "全年累计不超30天",
        "通知股东"
      ],
      "party": "registrar",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "AN_suspend_start",
      "end_offset_id": "AN_suspend_start"
    },
    {
      "id": "vote_upload_task",
      "category": "AGM",
      "name": "AGM投票结果公告+当晚23:00前ESS上传",
      "details": [
        "提前备投票结果公告模板",
        "含退任董事重选票数/INED比例",
        "AGM结束后立即填数",
        "当晚23:00前上传"
      ],
      "party": "company_secretary",
      "priority": "最高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_vote_upload",
      "type": "point"
    },
    {
      "id": "if001_task",
      "category": "AGM",
      "name": "IF001表格提交HKEX报备最终AGM时间",
      "details": [
        "AGM日期锁定后制备IF001",
        "经公司秘书签字",
        "上传ESS",
        "确认HKEX收悉"
      ],
      "party": "company_secretary",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_if001",
      "type": "point"
    },
    {
      "id": "agm_deadline",
      "category": "AGM",
      "name": "AGM最迟召开日备忘(T0+6个月)",
      "details": [
        "在日历标注T0+6个月为AGM最迟日",
        "当前T3须≤此日",
        "留4天余量防延期"
      ],
      "party": "company_secretary",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_agm_record",
      "type": "point"
    },
    {
      "id": "agm_notice_task",
      "category": "AGM",
      "name": "AGM通告付印(退任董事重选说明+委任表截止)",
      "details": [
        "制备AGM通告含全部决议案",
        "退任董事重选说明",
        "RH/NRH Letter随附",
        "印刷商付印"
      ],
      "party": "printer",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "AN_if001",
      "end_offset_id": "AN_if001"
    },
    {
      "id": "proxy_task",
      "category": "AGM",
      "name": "收集代表委任表之最后限期(AGM前48小时)",
      "details": [
        "制备代表委任表模板",
        "通知主要股东",
        "AGM前48小时为最后收件截止",
        "统计委任数"
      ],
      "party": "registrar",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "type": "range",
      "start_offset_id": "AN_if001",
      "end_offset_id": "AN_proxy_deadline"
    },
    {
      "id": "agm_record_date",
      "category": "AGM",
      "name": "AGM记录日，向股份过户处索取最新股东名单",
      "details": [
        "AGM当日为记录日",
        "向Tricor索取最新股东名册",
        "核对投票权",
        "归档"
      ],
      "party": "registrar",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_suspend_start",
      "type": "point"
    },
    {
      "id": "agm_minutes",
      "category": "AGM",
      "name": "AGM会议记录定稿+呈交HKEX(15天内)",
      "details": [
        "AGM后立即起草会议纪要",
        "含出席名单/法定人数/INED比例/决议结果",
        "核证本盖章",
        "T3+15天内呈交"
      ],
      "party": "company_secretary",
      "priority": "高优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_agm_record",
      "type": "point"
    },
    {
      "id": "agm_venue",
      "category": "AGM",
      "name": "预订场地+聘请点票员(Tricor)+邀请嘉宾",
      "details": [
        "预订AGM场地",
        "聘请Tricor为独立点票员",
        "邀请核数师/委员会主席/嘉宾",
        "确认董事出席"
      ],
      "party": "internal",
      "priority": "中优",
      "last_verified": "2026-01",
      "status": "active",
      "offset_id": "AN_suspend_notice",
      "type": "point"
    }
  ]
};
