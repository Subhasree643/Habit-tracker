const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Habit name is required'],
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    color: {
      type: String,
      default: '#4f9d69',
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly'],
      default: 'daily',
    },
    // Store each completed day as a 'YYYY-MM-DD' string (UTC) to avoid
    // timezone drift and to make lookups/toggling simple and idempotent.
    completions: {
      type: [String],
      default: [],
    },
    archived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Virtual: current streak, counted backwards from today (or yesterday if
// today isn't logged yet) through consecutive completed days.
habitSchema.virtual('currentStreak').get(function () {
  if (!this.completions || this.completions.length === 0) return 0;

  const set = new Set(this.completions);
  const oneDay = 24 * 60 * 60 * 1000;
  let cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  const toKey = (d) => d.toISOString().slice(0, 10);

  // If today isn't done yet, start checking from yesterday so an
  // in-progress streak isn't shown as broken.
  if (!set.has(toKey(cursor))) {
    cursor = new Date(cursor.getTime() - oneDay);
  }

  let streak = 0;
  while (set.has(toKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - oneDay);
  }
  return streak;
});

habitSchema.set('toJSON', { virtuals: true });
habitSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Habit', habitSchema);
