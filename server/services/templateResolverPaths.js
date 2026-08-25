/**
 * 模板变量 fieldPath 约定集中定义（director / meeting 来源）。
 *
 * 这些常量供 templateResolver.js 的 resolveDirectorValue / resolveMeetingValue 使用，
 * 并作为「合法 fieldPath 白名单」防止原型污染与任意字段访问。
 *
 * 安全红线：取值一律走白名单，禁止动态拼接访问任意嵌套字段。
 */

/**
 * director 来源允许的 fieldPath 及其语义标签。
 * @type {Readonly<Record<string,string>>}
 */
const DIRECTOR_FIELD_PATHS = Object.freeze({
  'director.name': '全体董事姓名（join「、」）',
  'director.chineseName': '全体董事中文名（join「、」）',
  'director.nric': '全体董事证件号（join「、」）',
  'director.role': '全体董事职位（join「、」，取自 Personnel.roles）',
  'director.count': '董事人数',
  'boardList': '全体董事「姓名(职位)」清单（join「、」）',
});

/**
 * meeting 来源允许的 fieldPath 及其语义标签。
 * @type {Readonly<Record<string,string>>}
 */
const MEETING_FIELD_PATHS = Object.freeze({
  'meeting.date': '会议日期（scheduledAt 别名）',
  'meeting.scheduledAt': '会议日期',
  'meeting.title': '会议标题',
  'meeting.agenda': '会议议程（array join）',
});

module.exports = {
  DIRECTOR_FIELD_PATHS,
  MEETING_FIELD_PATHS,
};
