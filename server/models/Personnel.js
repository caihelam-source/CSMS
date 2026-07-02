const mongoose = require('mongoose');

const personnelSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  nameChinese: { type: String, trim: true },
  nric: { type: String, trim: true, sparse: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  nationality: { type: String, trim: true },
  address: {
    street: String, city: String, state: String, postalCode: String, country: String,
  },
  // Legacy fields for compatibility
  dateOfBirth: Date,
  placeOfBirth: String,
  idType: String,
  idNumber: String,
  passportNumber: String,
  occupation: String,
  notes: String,
}, { timestamps: true });

personnelSchema.index({ name: 'text', nric: 'text', email: 'text' });
personnelSchema.index({ nric: 1 }, { sparse: true });

module.exports = mongoose.model('Personnel', personnelSchema);
