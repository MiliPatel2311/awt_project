const express = require('express');
const {
  listMyRegistrations,
  listAllRegistrations,
  registerForEvent,
  cancelRegistration,
  submitFeedback,
} = require('../controllers/registrationController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validateFeedback } = require('../middleware/validate');

const router = express.Router();

router.get('/me', protect, listMyRegistrations);
router.get('/', protect, authorize('admin'), listAllRegistrations);
router.post('/:eventId', protect, authorize('user'), registerForEvent);
router.put('/:eventId/feedback', protect, authorize('user'), validateFeedback, submitFeedback);
router.delete('/:eventId', protect, cancelRegistration);

module.exports = router;
