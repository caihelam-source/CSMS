/**
 * HTML → docSchema 转换测试（node:test，无需数据库）。
 * 覆盖：标题变量占位、段落变量、列表、表格降级、分隔线、空内容。
 */
const test = require('node:test');
const assert = require('node:assert');
const { convertHtmlToDocSchema } = require('../services/htmlToDocSchema');

test('convertHtmlToDocSchema: 标题变量替换为 BLANK_MD 并登记字段', () => {
  const html = '<h1>关于{{company}}的决议</h1>';
  const { docSchema, variables, report } = convertHtmlToDocSchema(html);

  assert.strictEqual(docSchema.layoutMode, 'custom');
  assert.strictEqual(docSchema.meta.docTitle, '关于＿＿＿＿＿＿的决议');
  const heading = docSchema.layout.sections[0];
  assert.strictEqual(heading.type, 'heading');
  assert.strictEqual(heading.level, 1);
  assert.strictEqual(heading.text, '关于＿＿＿＿＿＿的决议');
  assert.strictEqual(variables.length, 1);
  assert.strictEqual(variables[0].key, 'company');
  assert.strictEqual(variables[0].source, 'manual');
  assert.deepStrictEqual(report, []);
});

test('convertHtmlToDocSchema: 段落含变量 → segments 含 var', () => {
  const html = '<p>本决议由{{chairman}}主持，地点{{place}}。</p>';
  const { docSchema, variables } = convertHtmlToDocSchema(html);

  const para = docSchema.layout.sections.find((s) => s.type === 'paragraph');
  assert.ok(para, '应生成 paragraph 区块');
  // 文本 → var → 文本 → var → 文本：5 段
  const segs = para.segments;
  assert.strictEqual(segs.length, 5);
  assert.deepStrictEqual(segs[0], { text: '本决议由' });
  assert.deepStrictEqual(segs[1], { var: 'chairman' });
  assert.deepStrictEqual(segs[2], { text: '主持，地点' });
  assert.deepStrictEqual(segs[3], { var: 'place' });
  assert.deepStrictEqual(segs[4], { text: '。' });
  assert.strictEqual(variables.length, 2);
});

test('convertHtmlToDocSchema: 相邻文本片段合并', () => {
  const html = '<p>纯文本段，无变量</p>';
  const { docSchema } = convertHtmlToDocSchema(html);
  const para = docSchema.layout.sections.find((s) => s.type === 'paragraph');
  assert.strictEqual(para.segments.length, 1);
  assert.deepStrictEqual(para.segments[0], { text: '纯文本段，无变量' });
});

test('convertHtmlToDocSchema: ul/ol 列表每项为一段 paragraph', () => {
  const html = '<ul><li>第一项</li><li>第二项</li></ul>';
  const { docSchema } = convertHtmlToDocSchema(html);
  const paras = docSchema.layout.sections.filter((s) => s.type === 'paragraph');
  assert.strictEqual(paras.length, 2);
  assert.deepStrictEqual(paras[0].segments, [{ text: '• 第一项' }]);
  assert.deepStrictEqual(paras[1].segments, [{ text: '• 第二项' }]);
});

test('convertHtmlToDocSchema: 表格降级为 note + 留白段落并计入 report', () => {
  const html =
    '<table><tr><td>列1</td><td>列2</td></tr><tr><td>a</td><td>b</td></tr></table>';
  const { docSchema, report } = convertHtmlToDocSchema(html);

  const note = docSchema.layout.sections.find((s) => s.type === 'note');
  assert.ok(note, '应生成 note 区块');
  assert.match(note.text, /表格\(2行2列\)/);
  const blankPara = docSchema.layout.sections.find(
    (s) => s.type === 'paragraph' && Array.isArray(s.segments) && s.segments[0] && s.segments[0].blank === true
  );
  assert.ok(blankPara, '应生成留白段落');
  assert.ok(report.some((r) => /表格/.test(r)));
});

test('convertHtmlToDocSchema: hr → divider', () => {
  const html = '<p>上段</p><hr><p>下段</p>';
  const { docSchema } = convertHtmlToDocSchema(html);
  const types = docSchema.layout.sections.map((s) => s.type);
  assert.deepStrictEqual(types, ['paragraph', 'divider', 'paragraph']);
});

test('convertHtmlToDocSchema: 空内容生成合法（空 sections）schema', () => {
  const { docSchema, variables } = convertHtmlToDocSchema('<div></div>');
  // assertValidDocSchema 已在转换内部通过；此处校验结构完整
  assert.strictEqual(docSchema.layoutMode, 'custom');
  assert.ok(Array.isArray(docSchema.layout.sections));
  assert.deepStrictEqual(variables, []);
});

test('convertHtmlToDocSchema: 去除 script/style/doctype', () => {
  const html =
    '<!DOCTYPE html><html><head><style>.x{}</style></head><body>'
    + '<script>alert(1)</script><h2>标题{{title}}</h2><p>正文</p></body></html>';
  const { docSchema } = convertHtmlToDocSchema(html);
  const heading = docSchema.layout.sections.find((s) => s.type === 'heading');
  assert.strictEqual(heading.text, '标题＿＿＿＿＿＿');
  assert.ok(!docSchema.layout.sections.some((s) => /alert/.test(JSON.stringify(s))));
});

test('convertHtmlToDocSchema: 含点号的变量名被 sanitize 为合法 key', () => {
  const html = '<p>姓名：{{user.name}}</p>';
  const { variables } = convertHtmlToDocSchema(html);
  assert.strictEqual(variables.length, 1);
  assert.match(variables[0].key, /^[A-Za-z_][A-Za-z0-9_]*$/);
  assert.strictEqual(variables[0].key, 'user_name');
  // user.* 不是已知命名空间 → 必须降级为 manual（不能产出永远解析为空的"自动"字段）
  assert.strictEqual(variables[0].source, 'manual');
  assert.strictEqual(variables[0].fieldPath, '');
});

test('convertHtmlToDocSchema: 结构化变量名推断出 source + fieldPath（决策 2 自动填充不丢）', () => {
  const html =
    '<p>{{company.name}} 於 {{meeting.date}} 之 {{meeting.title}} 委任 {{director.name}}，'
    + '現任董事 {{director.count}} 人，名單：{{boardList}}，日期 {{system.today}}。</p>';
  const { variables } = convertHtmlToDocSchema(html);
  const byKey = Object.fromEntries(variables.map((v) => [v.key, v]));

  assert.deepStrictEqual(
    { source: byKey.company_name.source, fieldPath: byKey.company_name.fieldPath },
    { source: 'company', fieldPath: 'company.name' }
  );
  assert.deepStrictEqual(
    { source: byKey.meeting_date.source, fieldPath: byKey.meeting_date.fieldPath },
    { source: 'meeting', fieldPath: 'meeting.date' }
  );
  assert.strictEqual(byKey.meeting_title.source, 'meeting');
  assert.strictEqual(byKey.director_name.source, 'director');
  assert.strictEqual(byKey.director_count.fieldPath, 'director.count');
  assert.deepStrictEqual(
    { source: byKey.boardList.source, fieldPath: byKey.boardList.fieldPath },
    { source: 'director', fieldPath: 'boardList' }
  );
  // system.today → key 经 sanitize 为 system_today；fieldPath 去掉 'system.' 前缀
  // （resolveSystemValue 的 switch 收的是 'today' 这类短名）
  assert.deepStrictEqual(
    { source: byKey.system_today.source, fieldPath: byKey.system_today.fieldPath },
    { source: 'system', fieldPath: 'today' }
  );
});

test('convertHtmlToDocSchema: 无点号别名（companyName / today / meetingDate）也能推断来源', () => {
  const html = '<p>{{companyName}} / {{meetingDate}} / {{boardList}} / {{today}}</p>';
  const { variables } = convertHtmlToDocSchema(html);
  const byKey = Object.fromEntries(variables.map((v) => [v.key, v]));

  assert.strictEqual(byKey.companyName.source, 'company');
  assert.strictEqual(byKey.companyName.fieldPath, 'company.name');
  assert.strictEqual(byKey.meetingDate.fieldPath, 'meeting.date');
  assert.strictEqual(byKey.boardList.source, 'director');
  assert.strictEqual(byKey.today.source, 'system');
  assert.strictEqual(byKey.today.fieldPath, 'today');
});

test('convertHtmlToDocSchema: 语义含糊的裸名（date / name）保持 manual，不误判为自动字段', () => {
  const html = '<p>{{date}} / {{name}} / {{amount}}</p>';
  const { variables } = convertHtmlToDocSchema(html);
  assert.strictEqual(variables.length, 3);
  variables.forEach((v) => assert.strictEqual(v.source, 'manual', `${v.key} 应保持 manual`));
});

test('convertHtmlToDocSchema: 白名单外的 director/meeting 路径降级为 manual', () => {
  const html = '<p>{{director.salary}} / {{meeting.venue}}</p>';
  const { variables } = convertHtmlToDocSchema(html);
  assert.strictEqual(variables.length, 2);
  variables.forEach((v) => {
    assert.strictEqual(v.source, 'manual', `${v.key} 应降级为 manual`);
    assert.strictEqual(v.fieldPath, '');
  });
});

test('convertHtmlToDocSchema: 同一变量出现多次只登记一个字段（不产生 _1 后缀）', () => {
  const html =
    '<h1>{{company.name}} 通知書</h1><p>致：{{company.name}}</p><p>抄送：{{company.name}}</p>';
  const { docSchema, variables } = convertHtmlToDocSchema(html);

  assert.strictEqual(variables.length, 1, '同名变量应复用同一字段');
  assert.strictEqual(variables[0].key, 'company_name');
  assert.ok(!variables.some((v) => /_\d+$/.test(v.key)), '不应出现数字后缀字段');
  // 两段正文都引用同一个 key
  const varSegs = docSchema.layout.sections
    .filter((s) => s.type === 'paragraph')
    .flatMap((s) => s.segments)
    .filter((sg) => sg.var);
  assert.strictEqual(varSegs.length, 2);
  varSegs.forEach((sg) => assert.strictEqual(sg.var, 'company_name'));
});

test('convertHtmlToDocSchema: 列表项内的 {{var}} 登记为字段而非字面量；ol 保留序号', () => {
  const html =
    '<ol><li>生效日期：{{effectiveDate}}</li><li>董事 {{director.count}} 人</li></ol>'
    + '<ul><li>經辦人：{{handler}}</li></ul>';
  const { docSchema, variables } = convertHtmlToDocSchema(html);

  // 变量必须被登记（旧实现会把 {{effectiveDate}} 当纯文本静默丢弃）
  const keys = variables.map((v) => v.key);
  assert.ok(keys.includes('effectiveDate'), '列表内变量必须登记为字段');
  assert.ok(keys.includes('director_count'));
  assert.ok(keys.includes('handler'));

  const paras = docSchema.layout.sections.filter((s) => s.type === 'paragraph');
  assert.deepStrictEqual(paras[0].segments, [{ text: '1. 生效日期：' }, { var: 'effectiveDate' }]);
  assert.deepStrictEqual(paras[1].segments, [
    { text: '2. 董事' },
    { var: 'director_count' },
    { text: '人' },
  ]);
  assert.deepStrictEqual(paras[2].segments, [{ text: '• 經辦人：' }, { var: 'handler' }]);
  // 正文里不得残留 {{ }} 字面量
  assert.ok(!/\{\{/.test(JSON.stringify(docSchema.layout.sections)));
});
