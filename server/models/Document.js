const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Document name required'], trim: true },
  description: { type: String, maxlength: 1000 },
  type: {
    type: String,
    enum: ['minutes', 'resolution', 'agreement', 'form', 'certificate', 'return', 'notice', 'memo',
           'annual_report', 'financial_statement', 'id_document', 'passport', 'proof_of_address',
           'board_resolution', 'incorporation_doc', 'other'],
    default: 'other',
  },
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number },
  mimeType: { type: String },
  // Linked entities
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  personnel: { type: mongoose.Schema.Types.ObjectId, ref: 'Personnel' },
  meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, default: 1 },
  tags: [String],
  isConfidential: { type: Boolean, default: false },
  expiresAt: { type: Date },
  annualRenewal: { type: Boolean, default: false },
  renewalDueDate: { type: Date },
  documentYear: { type: Number },
  // Legacy fields
  docNumber: { type: String, unique: true, sparse: true },
  signStatus: { type: String, enum: ['draft', 'pending_sign', 'partially_signed', 'fully_signed', 'archived'], default: 'draft' },
}, { timestamps: true });

documentSchema.index({ company: 1, type: 1 });
documentSchema.index({ personnel: 1, type: 1 });
documentSchema.index({ renewalDueDate: 1 });

module.exports = mongoose.model('Document', documentSchema);
