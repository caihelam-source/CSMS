const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Company name required'], trim: true },
  nameChinese: { type: String, trim: true },
  stockCode: { type: String, trim: true },
  registrationNumber: { type: String, unique: true, trim: true },
  type: { type: String, enum: ['private_limited', 'public_limited', 'llp', 'sole_proprietorship', 'partnership', 'other'], default: 'private_limited' },
  status: { type: String, enum: ['active', 'dormant', 'struck_off', 'winding_up', 'dissolved'], default: 'active' },
  jurisdiction: { type: String, default: 'Hong Kong' },
  incorporationDate: { type: Date },

  // Addresses
  registeredAddress: {
    street: String, city: String, state: String, postalCode: String, country: String,
  },
  businessAddress: {
    street: String, city: String, state: String, postalCode: String, country: String,
  },

  // Unified links — can reference Personnel or Company
  links: [{
    linkModel: { type: String, enum: ['Personnel', 'Company'], required: true },
    link: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'links.linkModel' },
    roles: [{ type: String, enum: ['director', 'alternate_director', 'shareholder', 'secretary', 'auditor', 'other'] }],
    shares: Number,
    shareType: { type: String, enum: ['ordinary', 'preference', 'other'], default: 'ordinary' },
    appointmentDate: Date,
    cessationDate: Date,
    notes: String,
  }],

  // Share capital
  shareCapital: {
    issued: Number, paidUp: Number, currency: { type: String, default: 'HKD' },
  },

  // Financial
  financialYearEnd: { day: Number, month: Number },

  // Compliance
  compliance: {
    agmDueDate: Date, arDueDate: Date, lastAgmDate: Date, lastArDate: Date,
    taxFilingDue: Date,
  },

  // Legacy fields
  isListed: { type: Boolean, default: false },
  listingLocation: { type: String },
  businessNature: { type: String },
  industry: { type: String },
  phone: { type: String },
  email: { type: String },
  website: { type: String },
  companySecretary: { type: String },
  notes: { type: String },

  tags: [String],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

companySchema.index({ name: 1 });
companySchema.index({ 'compliance.agmDueDate': 1 });
companySchema.index({ 'compliance.arDueDate': 1 });
companySchema.index({ 'links.link': 1 });

module.exports = mongoose.model('Company', companySchema);
