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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
}, { timestamps: true });

resultsTimetableSchema.index({ company: 1, period: 1 });

module.exports = mongoose.model('ResultsTimetable', resultsTimetableSchema);
