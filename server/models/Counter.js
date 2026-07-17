const mongoose = require('mongoose');

/**
 * Atomic sequence counter for generating unique document numbers.
 * Each document type + year combination gets its own counter row.
 * Usage: Counter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, new: true })
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },   // e.g. "DOC-MINU-2026"
  seq: { type: Number, default: 0 },
}, { collection: 'counters' });

module.exports = mongoose.model('Counter', counterSchema);
