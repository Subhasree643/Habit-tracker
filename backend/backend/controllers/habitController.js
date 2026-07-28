const Habit = require('../models/Habit');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/habits
async function getHabits(req, res, next) {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const filter = includeArchived ? {} : { archived: false };
    const habits = await Habit.find(filter).sort({ createdAt: 1 });
    res.json({ success: true, count: habits.length, data: habits });
  } catch (err) {
    next(err);
  }
}

// GET /api/habits/:id
async function getHabit(req, res, next) {
  try {
    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    res.json({ success: true, data: habit });
  } catch (err) {
    next(err);
  }
}

// POST /api/habits
async function createHabit(req, res, next) {
  try {
    const { name, description, color, frequency } = req.body;
    const habit = await Habit.create({ name, description, color, frequency });
    res.status(201).json({ success: true, data: habit });
  } catch (err) {
    next(err);
  }
}

// PUT /api/habits/:id
async function updateHabit(req, res, next) {
  try {
    const { name, description, color, frequency, archived } = req.body;
    const habit = await Habit.findByIdAndUpdate(
      req.params.id,
      { name, description, color, frequency, archived },
      { new: true, runValidators: true, omitUndefined: true }
    );
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    res.json({ success: true, data: habit });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/habits/:id
async function deleteHabit(req, res, next) {
  try {
    const habit = await Habit.findByIdAndDelete(req.params.id);
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }
    res.json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/habits/:id/toggle  { date: 'YYYY-MM-DD' }
// Marks the given day complete if it wasn't, or un-marks it if it was.
async function toggleCompletion(req, res, next) {
  try {
    const { date } = req.body;
    if (!date || !DATE_RE.test(date)) {
      return res.status(400).json({ success: false, message: "Body must include date as 'YYYY-MM-DD'" });
    }

    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    const idx = habit.completions.indexOf(date);
    if (idx === -1) {
      habit.completions.push(date);
    } else {
      habit.completions.splice(idx, 1);
    }
    habit.completions.sort();
    await habit.save();

    res.json({ success: true, data: habit });
  } catch (err) {
    next(err);
  }
}

// GET /api/habits/:id/stats
async function getStats(req, res, next) {
  try {
    const habit = await Habit.findById(req.params.id);
    if (!habit) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    const totalCompletions = habit.completions.length;
    const daysSinceCreated =
      Math.floor((Date.now() - habit.createdAt.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const completionRate = daysSinceCreated > 0 ? totalCompletions / daysSinceCreated : 0;

    res.json({
      success: true,
      data: {
        totalCompletions,
        currentStreak: habit.currentStreak,
        daysSinceCreated,
        completionRate: Math.round(completionRate * 100),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHabits,
  getHabit,
  createHabit,
  updateHabit,
  deleteHabit,
  toggleCompletion,
  getStats,
};
