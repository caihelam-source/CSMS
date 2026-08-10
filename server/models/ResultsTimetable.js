const mongoose = require('mongoose');

/**
 * ResultsTimetable — 港股业绩公告全周期排期头 + 任务项
 *
 * 落库打通：生成排期时存此文档（锚点 + 47/25 条任务项），
 * 同时把每条任务项回写为 company 下的 Task(type=results_timetable)，
 * 使排期任务自动出现在 Dashboard 逾期面板 / 进度总览 / 人员 360° 中。
 */
const itemSchema = new mongoose.Schema({
  index: Number,
  category: String,
  rule: String,
  title: String,
  steps: String,
  priority: String,     // 最高优/高优/中优/低优
  status: String,       // 未启动/进行中/部分完成/已完成
  project: String,
  owner: String,
  agency: String,
  startDate: Date,
  endDate: Date,
  file: String,
  note: String,
}, { _id: false });

const resultsTimetableSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  period: {
    type: String,
    enum: ['interim', 'annual'],
    required: true
  },
  fiscalYear: String,
  code: String,
  name: String,
  anchors: {
    T0: Date,
    T1: Date,
    T2: Date,
    T3: Date,
    T4: Date,
  },
  status: {
    type: String,
    enum: ['draft', 'generated', 'archived'],
    default: 'generated'
  },
  items: [itemSchema],
  /**
   * 生成当时的规则库修订号（= RuleLibrary.revision）。
   * 0 表示生成时库中无文档、走的是内置种子 timetableData.js。
   */
  ruleLibraryVersion: {
    type: Number,
    default: 0
  },
  /**
   * 生成当时的规则库**全量快照**（Mixed）。
   *
   * 为什么要整份存下来：规则库是可被 admin 随时改写 / 整库导入的单例文档，
   * 一旦改动，用「当下规则库」重算历史排期的偏移量、合规自检与规则出处就会与
   * 生成当天出具给董事会的版本不一致。快照把生成时刻的规则内容钉死在结果文档上，
   * 使历史排期在任何时点都能**精确复现**（见 routes/resultsTimetable.js libraryForDoc）。
   *
   * 形状：{ version, revision, meta, parties, rules,
   *        offsets_midyear, offsets_annual, tasks_midyear, tasks_annual,
   *        compliance_checks, generatedAt }
   */
  ruleLibrarySnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
}, { timestamps: true, minimize: false });

resultsTimetableSchema.index({ company: 1, period: 1 });

module.exports = mongoose.model('ResultsTimetable', resultsTimetableSchema);
