const express = require('express');
const DocumentTemplate = require('../models/DocumentTemplate');
const Company = require('../models/Company');
const Director = require('../models/Director');
const { auth } = require('../middleware/auth');

const router = express.Router();

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
    const templates = await DocumentTemplate.find(query)
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
    const tmpl = await DocumentTemplate.findById(req.params.id).populate('company');
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
        vars['注册地址'] = company.registeredAddress || '';
        vars['成立日期'] = company.incorporationDate ? company.incorporationDate.toLocaleDateString('zh-HK') : '';
        vars['注册号'] = company.registrationNumber || '';
        vars['股票代码'] = company.stockCode || '';
      }
    }

    // 自动从董事填充
    if (directorIds && directorIds.length > 0) {
      const directors = await Director.find({ _id: { $in: directorIds } });
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
  ];
}

module.exports = router;
