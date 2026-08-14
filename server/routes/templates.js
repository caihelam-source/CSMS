const express = require('express');
const DocumentTemplate = require('../models/DocumentTemplate');
const Company = require('../models/Company');
const Personnel = require('../models/Personnel');
const { auth } = require('../middleware/auth');

const router = express.Router();

// ── 辅助函数 ────────────────────────────────────────────────────
/**
 * 将结构化地址对象格式化为单行可读文本。
 *
 * Company.registeredAddress / businessAddress 均为
 * { street, city, state, postalCode, country } 结构。
 * 渲染模板时直接将对象塞入 {{注册地址}} 会 coerce 成 "[object Object]"，
 * 因此必须先转换为字符串。
 *
 * @param {object} [addr] 地址对象
 * @returns {string} 例如 "1/F, Central, Hong Kong"
 */
const formatAddress = (addr) => {
  if (!addr || typeof addr !== 'object') return '';
  return [
    addr.street,
    addr.city,
    addr.state,
    addr.postalCode,
    addr.country,
  ]
    .filter((part) => part && String(part).trim() !== '')
    .join(', ');
};

// GET /api/templates
router.get('/', auth, async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};
    if (category) query.category = category;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
    const templates = await DocumentTemplate.find(query).lean()
      .populate('company', 'name')
      .sort({ isPreset: -1, name: 1 });
    res.json({ success: true, count: templates.length, templates });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/templates/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const tmpl = await DocumentTemplate.findById(req.params.id).lean().populate('company');
    if (!tmpl) return res.status(404).json({ message: 'Template not found' });
    res.json({ success: true, template: tmpl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/templates
router.post('/', auth, async (req, res) => {
  try {
    // 自动从 content 提取 {{变量}}
    const content = req.body.content || '';
    const matches = [...new Set(content.match(/\{\{([^}]+)\}\}/g) || [])];
    const variables = matches.map(m => {
      const key = m.replace(/\{\{|\}\}/g, '').trim();
      return { key, label: key, source: 'manual', fieldPath: '' };
    });
    const tmpl = await DocumentTemplate.create({ ...req.body, variables, createdBy: req.user._id });
    res.status(201).json({ success: true, template: tmpl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/templates/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const content = req.body.content || '';
    const matches = [...new Set(content.match(/\{\{([^}]+)\}\}/g) || [])];
    const variables = matches.map(m => {
      const key = m.replace(/\{\{|\}\}/g, '').trim();
      const existing = (req.body.variables || []).find(v => v.key === key);
      return existing || { key, label: key, source: 'manual', fieldPath: '' };
    });
    const tmpl = await DocumentTemplate.findByIdAndUpdate(
      req.params.id, { ...req.body, variables }, { new: true }
    );
    if (!tmpl) return res.status(404).json({ message: 'Template not found' });
    res.json({ success: true, template: tmpl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const tmpl = await DocumentTemplate.findById(req.params.id);
    if (!tmpl) return res.status(404).json({ message: 'Template not found' });
    if (tmpl.isPreset) return res.status(403).json({ message: '预设模板不可删除' });
    await tmpl.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/templates/:id/render — 渲染模板（填入变量值），返回 HTML
router.post('/:id/render', auth, async (req, res) => {
  try {
    const tmpl = await DocumentTemplate.findById(req.params.id);
    if (!tmpl) return res.status(404).json({ message: 'Template not found' });

    const { companyId, directorIds, manualVars } = req.body;
    const vars = { ...manualVars };

    // 自动从公司填充
    if (companyId) {
      const company = await Company.findById(companyId);
      if (company) {
        vars['公司名称'] = company.name;
        vars['公司中文名'] = company.nameChinese || '';
        vars['注册地址'] = formatAddress(company.registeredAddress);
        vars['成立日期'] = company.incorporationDate ? company.incorporationDate.toLocaleDateString('zh-HK') : '';
        vars['注册号'] = company.registrationNumber || '';
        vars['股票代码'] = company.stockCode || '';
      }
    }

    // 自动从董事填充
    if (directorIds && directorIds.length > 0) {
      const directors = await Personnel.find({ _id: { $in: directorIds } });
      vars['董事列表'] = directors.map(d => d.nameChinese || d.name).join('、');
      directors.forEach((d, i) => {
        vars[`董事${i + 1}姓名`] = d.name;
        vars[`董事${i + 1}中文名`] = d.nameChinese || '';
      });
    }

    // 替换 {{变量}}
    let rendered = tmpl.content;
    Object.entries(vars).forEach(([k, v]) => {
      rendered = rendered.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || '');
    });

    res.json({ success: true, html: rendered, variables: vars });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/templates/initialize — 初始化预设模板
router.post('/initialize', auth, async (req, res) => {
  try {
    const presets = getPresetTemplates();
    let added = 0;
    for (const t of presets) {
      const exists = await DocumentTemplate.findOne({ name: t.name, isPreset: true });
      if (!exists) { await DocumentTemplate.create(t); added++; }
    }
    res.json({ success: true, added });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function getPresetTemplates() {
  return [
    {
      name: '董事会决议（通用）',
      description: '标准董事会决议模板，适用于一般事项审批',
      category: 'board_resolution',
      isPreset: true,
      content: `<h2 style="text-align:center">{{公司名称}}</h2>
<h3 style="text-align:center">董事会决议</h3>
<p><strong>决议日期：</strong>{{会议日期}}</p>
<p><strong>出席董事：</strong>{{董事列表}}</p>
<hr/>
<h4>决议事项</h4>
<p>经全体出席董事一致通过，决议如下：</p>
<p>{{决议内容}}</p>
<hr/>
<p>以上决议经全体出席董事签署确认。</p>
<br/>
<p>___________________________</p>
<p>主席签名 / Chairman's Signature</p>
<p>日期：{{签署日期}}</p>`,
      variables: [
        { key: '公司名称', label: '公司名称', source: 'company', fieldPath: 'company.name' },
        { key: '会议日期', label: '会议日期', source: 'manual', fieldPath: '' },
        { key: '董事列表', label: '出席董事', source: 'director', fieldPath: '' },
        { key: '决议内容', label: '决议内容', source: 'manual', fieldPath: '' },
        { key: '签署日期', label: '签署日期', source: 'manual', fieldPath: '' },
      ],
    },
    {
      name: '股东大会通知',
      description: '年度股东大会 (AGM) 召开通知',
      category: 'agm_resolution',
      isPreset: true,
      content: `<h2 style="text-align:center">{{公司名称}}</h2>
<h3 style="text-align:center">{{公司中文名}}</h3>
<h3 style="text-align:center">股东大会通知</h3>
<p>谨通知各位股东，本公司将于以下时间召开股东大会：</p>
<p><strong>日期：</strong>{{会议日期}}</p>
<p><strong>时间：</strong>{{会议时间}}</p>
<p><strong>地点：</strong>{{会议地点}}</p>
<h4>议程</h4>
<ol>
<li>{{议程第一项}}</li>
<li>{{议程第二项}}</li>
<li>{{议程第三项}}</li>
</ol>
<p>代表董事会</p>
<p>{{公司秘书姓名}}</p>
<p>公司秘书</p>`,
      variables: [
        { key: '公司名称', label: '公司名称', source: 'company', fieldPath: 'company.name' },
        { key: '公司中文名', label: '公司中文名', source: 'company', fieldPath: 'company.nameChinese' },
        { key: '会议日期', label: '会议日期', source: 'manual', fieldPath: '' },
        { key: '会议时间', label: '会议时间', source: 'manual', fieldPath: '' },
        { key: '会议地点', label: '会议地点', source: 'manual', fieldPath: '' },
        { key: '议程第一项', label: '议程第一项', source: 'manual', fieldPath: '' },
        { key: '议程第二项', label: '议程第二项', source: 'manual', fieldPath: '' },
        { key: '议程第三项', label: '议程第三项', source: 'manual', fieldPath: '' },
        { key: '公司秘书姓名', label: '公司秘书姓名', source: 'manual', fieldPath: '' },
      ],
    },
    {
      name: '董事任命通知',
      description: '委任新董事的正式通知',
      category: 'director_change',
      isPreset: true,
      content: `<h2 style="text-align:center">{{公司名称}} 董事任命通知</h2>
<p>兹通知，{{公司名称}}（注册号：{{注册号}}）董事会于{{任命日期}}批准委任：</p>
<p><strong>姓名：</strong>{{新董事姓名}}</p>
<p><strong>职位：</strong>{{新董事职位}}</p>
<p><strong>生效日期：</strong>{{生效日期}}</p>
<p>特此通知。</p>
<p>代表董事会</p>
<p>{{公司秘书姓名}}</p>`,
      variables: [
        { key: '公司名称', label: '公司名称', source: 'company', fieldPath: 'company.name' },
        { key: '注册号', label: '注册号', source: 'company', fieldPath: 'company.registrationNumber' },
        { key: '任命日期', label: '任命日期', source: 'manual', fieldPath: '' },
        { key: '新董事姓名', label: '新董事姓名', source: 'director', fieldPath: '' },
        { key: '新董事职位', label: '新董事职位', source: 'manual', fieldPath: '' },
        { key: '生效日期', label: '生效日期', source: 'manual', fieldPath: '' },
        { key: '公司秘书姓名', label: '公司秘书姓名', source: 'manual', fieldPath: '' },
      ],
    },
    {
      name: '公司秘书辞任信',
      description: '公司秘书辞任通知书（离职秘书签署）',
      category: 'secretary_change',
      isPreset: true,
      content: `<h2 style="text-align:center">Letter of Resignation</h2>
<h3 style="text-align:center">公司秘书辞任信</h3>
<p><strong>Date 日期：</strong>{{出具日期}}</p>
<p><strong>To 致：</strong>The Board of Directors</p>
<p>{{公司名称}}</p>
<p>{{公司中文名}}</p>
<p>(the &quot;Company&quot;)</p>
<hr/>
<p>Dear Sirs</p>
<p><strong>Resignation as company secretary, chief financial officer and authorised representatives of the Company</strong></p>
<p>I, the undersigned, hereby tender my resignation as (i) the company secretary; (ii) the chief financial officer; (iii) an authorised representative under Rule 3.05 of the Rules Governing the Listing of Securities on The Stock Exchange of Hong Kong Limited (the &quot;Stock Exchange&quot;); and (iv) the authorised representative for accepting service of process or notice in Hong Kong under Part 16 of the Companies Ordinance (Chapter 622 of the Laws of Hong Kong) of the Company with effect from {{生效日期}} (&quot;Resignations&quot;), as {{辞任原因}}.</p>
<p>I confirm that I have no claim against the Company whatsoever whether by way of compensation, remuneration, severance payments, expenses, damages or otherwise for loss of office. I also confirm that I have no disagreement with the board of directors of the Company and that there is no matter in relation to my Resignations that needs to be brought to the attention of the shareholders of the Company or the Stock Exchange.</p>
<hr/>
<p>Yours faithfully</p>
<br/>
<p>____________________________</p>
<p>{{辞任秘书姓名}}（{{辞任秘书中文名}}）</p>`,
      variables: [
        { key: '出具日期', label: '出具日期', source: 'manual', fieldPath: '' },
        { key: '公司名称', label: '公司名称', source: 'company', fieldPath: 'company.name' },
        { key: '公司中文名', label: '公司中文名', source: 'company', fieldPath: 'company.nameChinese' },
        { key: '生效日期', label: '辞任生效日期', source: 'manual', fieldPath: '' },
        { key: '辞任原因', label: '辞任原因（英文表述）', source: 'manual', fieldPath: '' },
        { key: '辞任秘书姓名', label: '辞任秘书姓名（英文）', source: 'manual', fieldPath: '' },
        { key: '辞任秘书中文名', label: '辞任秘书中文名', source: 'manual', fieldPath: '' },
      ],
    },
    {
      name: '公司秘书同意出任函',
      description: '同意出任公司秘书同意书（新任秘书签署）',
      category: 'secretary_change',
      isPreset: true,
      content: `<h2 style="text-align:center">Consent to Act</h2>
<h3 style="text-align:center">同意出任公司秘书同意书</h3>
<p><strong>Date 日期：</strong>{{出具日期}}</p>
<p><strong>To 致：</strong>The Board of Directors</p>
<p>{{公司名称}} (the &quot;Company&quot;)</p>
<p>{{注册地址}}</p>
<hr/>
<p>Dear Sirs,</p>
<p><strong>Consent to act as company secretary and authorised representatives of the Company</strong></p>
<p>I, the undersigned, hereby consent to my appointment to act as (i) the company secretary; (ii) an authorised representative under Rule 3.05 of the Rules Governing the Listing of Securities on The Stock Exchange of Hong Kong Limited; and (iii) the authorised representative for accepting service of process or notice in Hong Kong under Part 16 of the Companies Ordinance (Chapter 622 of the Laws of Hong Kong) of the Company with effect from {{生效日期}}.</p>
<p>I designate the following address, telephone number and e-mail address for service of notice. Notice by mail, telephone or e-mail to the following address, number or e-mail address, shall constitute good and sufficient notice to myself and I agree to advise you of any change in these particulars.</p>
<p>I hereby authorise you to (i) enter my name and address in the Register of Directors and Officers of the Company; and (ii) provide my name, address and other contact details to The Stock Exchange of Hong Kong Limited, the relevant companies registry and other competent authorities.</p>
<table style="width:100%;border-collapse:collapse">
<tbody>
<tr><td style="border:1px solid #ddd;padding:6px;width:38%">Name in full 姓名</td><td style="border:1px solid #ddd;padding:6px">{{同意出任秘书姓名}}</td></tr>
<tr><td style="border:1px solid #ddd;padding:6px">Nationality 国籍</td><td style="border:1px solid #ddd;padding:6px">{{国籍}}</td></tr>
<tr><td style="border:1px solid #ddd;padding:6px">Hong Kong Identity Card No. 香港身份证号码</td><td style="border:1px solid #ddd;padding:6px">{{香港身份证号}}</td></tr>
<tr><td style="border:1px solid #ddd;padding:6px">Correspondence address 通讯地址</td><td style="border:1px solid #ddd;padding:6px">{{通讯地址}}</td></tr>
<tr><td style="border:1px solid #ddd;padding:6px">Telephone 电话</td><td style="border:1px solid #ddd;padding:6px">{{联系电话}}</td></tr>
<tr><td style="border:1px solid #ddd;padding:6px">E-mail address 电子邮箱</td><td style="border:1px solid #ddd;padding:6px">{{电子邮箱}}</td></tr>
</tbody>
</table>
<hr/>
<p>Yours faithfully,</p>
<br/>
<p>____________________________</p>
<p>{{同意出任秘书姓名}}</p>`,
      variables: [
        { key: '出具日期', label: '出具日期', source: 'manual', fieldPath: '' },
        { key: '公司名称', label: '公司名称', source: 'company', fieldPath: 'company.name' },
        { key: '注册地址', label: '公司注册地址', source: 'company', fieldPath: 'company.registeredAddress' },
        { key: '生效日期', label: '出任生效日期', source: 'manual', fieldPath: '' },
        { key: '同意出任秘书姓名', label: '同意出任秘书姓名', source: 'manual', fieldPath: '' },
        { key: '国籍', label: '国籍', source: 'manual', fieldPath: '' },
        { key: '香港身份证号', label: '香港身份证号码', source: 'manual', fieldPath: '' },
        { key: '通讯地址', label: '通讯地址', source: 'manual', fieldPath: '' },
        { key: '联系电话', label: '联系电话', source: 'manual', fieldPath: '' },
        { key: '电子邮箱', label: '电子邮箱', source: 'manual', fieldPath: '' },
      ],
    },
  ];
}

module.exports = router;
