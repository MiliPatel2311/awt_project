const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    status: {
      type: String,
      enum: ['registered', 'waitlisted'],
      default: 'registered',
    },
    promotedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['registered', 'waitlisted'],
      default: 'registered',
      index: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: [500, 'Feedback must be 500 characters or fewer'],
      default: '',
    },
    feedbackSubmittedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

registrationSchema.index({ user: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
