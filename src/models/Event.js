const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters long'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['tech', 'fun', 'fest', 'sports', 'business'],
      required: [true, 'Category is required'],
      lowercase: true,
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    durationMinutes: {
      type: Number,
      default: 180,
      min: [30, 'Duration must be at least 30 minutes'],
    },
    seatLimit: {
      type: Number,
      required: [true, 'Seat limit is required'],
      min: [1, 'Seat limit must be at least 1'],
    },
    registeredSeats: {
      type: Number,
      default: 0,
      min: 0,
    },
    waitlistedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=80',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

eventSchema.virtual('availableSeats').get(function getAvailableSeats() {
  return Math.max(this.seatLimit - this.registeredSeats, 0);
});

eventSchema.virtual('endDate').get(function getEndDate() {
  return new Date(new Date(this.date).getTime() + this.durationMinutes * 60 * 1000);
});

module.exports = mongoose.model('Event', eventSchema);
