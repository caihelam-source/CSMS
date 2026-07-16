const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  type: {
    type: String,
    enum: ['filing', 'compliance', 'meeting_preparation', 'document_review', 'other'],
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting'
  },
  personnel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Personnel'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'overdue'],
    default: 'pending'
  },
  dueDate: {
    type: Date,
    required: true
  },
  completedDate: Date,
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: [{
    content: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  reminders: [{
    date: Date,
    sent: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true
});

// Update status based on due date
taskSchema.pre('save', function(next) {
  if (this.status === 'pending' && this.dueDate < new Date()) {
    this.status = 'overdue';
  }
  next();
});

// v5.0 读时聚合索引：以 company / personnel / meeting 引用为聚合键
taskSchema.index({ company: 1 });
taskSchema.index({ personnel: 1 });
taskSchema.index({ meeting: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ status: 1 });

module.exports = mongoose.model('Task', taskSchema);
