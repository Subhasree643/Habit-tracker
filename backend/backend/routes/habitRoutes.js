const express = require('express');
const router = express.Router();
const {
  getHabits,
  getHabit,
  createHabit,
  updateHabit,
  deleteHabit,
  toggleCompletion,
  getStats,
} = require('../controllers/habitController');

router.route('/').get(getHabits).post(createHabit);

router.route('/:id').get(getHabit).put(updateHabit).delete(deleteHabit);

router.patch('/:id/toggle', toggleCompletion);
router.get('/:id/stats', getStats);

module.exports = router;
