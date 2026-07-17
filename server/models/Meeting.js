const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema({
  name: { type: String, required: true },
  title: String,
  signedAt: Date,
  signature: String, // base64 or path to signature image
  status: { type: String, enum: ['pending', 'signed'], default: 'pending' },
}, { _id: true });

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Meeting title required'], trim: true, maxlength: 200 },
  description: { type: String, maxlength: 2000 },
  type: { type: String, enum: ['board', 'agm', 'egm', 'committee', 'other'], default: 'board' },
  status: { type: String, enum: ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'], default: 'draft' },

  // === Phased workflow ===
  // setup → notice-draft → notice-sent → meeting-held → minutes-draft → minutes-signed → completed
  phase: { type: String, enum: ['setup', 'notice-draft', 'notice-sent', 'meeting-held', 'minutes-draft', 'minutes-signed', 'completed'], default: 'setup' },

  scheduledAt: { type: Date },
  scheduledEndAt: { type: Date },
  duration: { type: Number, default: 60 }, // minutes

  location: { type: String, trim: true },
  isVirtual: { type: Boolean, default: false },
  meetingLink: { type: String },
  meetingId: { type: String },
  meetingPassword: { type: String },

  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // === Attendees: Polymorphic ref (Personnel/Company) + Ad-hoc ===
  attendees: [{
    // Linked to Personnel/Company
    refModel: { type: String, enum: ['Personnel', 'Company'] },
    ref: { type: mongoose.Schema.Types.ObjectId, refPath: 'attendees.refModel' },
    // Always have name/role (for ad-hoc attendees, no refModel/ref)
    name: { type: String, required: true },
    role: String,
    organization: String,
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'attended'], default: 'pending' },
  }],

  // === Agenda ===
  agenda: [{
    item: String,
    presenter: String,
    duration: Number,
    notes: String,
    resolutions: [{
      title: String,
      description: String,
      status: { type: String, enum: ['proposed', 'approved', 'rejected', 'deferred'], default: 'proposed' },
      voteResult: String,
    }],
  }],

  // === Meeting Notice (auto-generated) ===
  notice: {
    content: String,        // raw editor content for custom editing
    generatedHtml: String,  // auto-generated preview HTML
    greeting: { type: String, default: '尊敬的各位董事' },
    signOff: { type: String, default: '请准时参加，如有问题请随时与我沟通，谢谢。' },
    customNote: String,
    sentAt: Date,
  },

  // === Meeting Minutes (generated after meeting) ===
  minutes: {
    content: String,
    generatedHtml: String,
    status: { type: String, enum: ['none', 'draft', 'final', 'signed'], default: 'none' },
    draftedAt: Date,
    signedAt: Date,
  },

  // === Signatures for minutes ===
  signatures: [signatureSchema],

  // === Resolution summary (agenda-level) ===
  resolutions: [{
    title: String,
    description: String,
    status: { type: String, enum: ['proposed', 'approved', 'rejected', 'deferred'], default: 'proposed' },
    voteResult: String,
  }],

  documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  notes: String,

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

meetingSchema.index({ company: 1, scheduledAt: -1 });
meetingSchema.index({ status: 1 });
meetingSchema.index({ phase: 1 });
// 全文本搜索索引（搜索增强 M2.1）
meetingSchema.index({ title: 'text', location: 'text' });

module.exports = mongoose.model('Meeting', meetingSchema);
