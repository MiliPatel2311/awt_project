const express = require('express');
const {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getAnalytics,
} = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validateEvent } = require('../middleware/validate');

const router = express.Router();

router.get('/analytics/overview', getAnalytics);
router.get('/', listEvents);
router.get('/:id', getEvent);
router.post('/', protect, authorize('admin'), validateEvent, createEvent);
router.put('/:id', protect, authorize('admin'), validateEvent, updateEvent);
router.delete('/:id', protect, authorize('admin'), deleteEvent);

module.exports = router;
