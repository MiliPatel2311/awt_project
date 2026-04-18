const Event = require('../models/Event');
const Registration = require('../models/Registration');
const asyncHandler = require('../utils/asyncHandler');

const refreshEventRating = async (eventId) => {
  const [summary] = await Registration.aggregate([
    {
      $match: {
        event: eventId,
        $or: [{ status: 'registered' }, { status: { $exists: false } }],
        rating: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$event',
        averageRating: { $avg: '$rating' },
        ratingsCount: { $sum: 1 },
      },
    },
  ]);

  await Event.findByIdAndUpdate(eventId, {
    averageRating: summary ? Number(summary.averageRating.toFixed(1)) : 0,
    ratingsCount: summary ? summary.ratingsCount : 0,
  });
};

const addWaitlistPositions = (registrations) => {
  const plainRegistrations = registrations.map((registration) => registration.toObject());
  const waitlistsByEvent = new Map();

  plainRegistrations.forEach((registration) => {
    if (registration.status !== 'waitlisted' || !registration.event) {
      return;
    }

    const eventId = String(registration.event._id || registration.event);
    const currentWaitlist = waitlistsByEvent.get(eventId) || [];
    currentWaitlist.push(registration);
    waitlistsByEvent.set(eventId, currentWaitlist);
  });

  waitlistsByEvent.forEach((waitlist) => {
    waitlist
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .forEach((registration, index) => {
        registration.waitlistPosition = index + 1;
      });
  });

  return plainRegistrations;
};

const listMyRegistrations = asyncHandler(async (req, res) => {
  const registrations = await Registration.find({ user: req.user._id })
    .populate('event')
    .sort({ createdAt: -1 });

  res.json(addWaitlistPositions(registrations));
});

const listAllRegistrations = asyncHandler(async (req, res) => {
  const registrations = await Registration.find()
    .populate('user', 'name email role')
    .populate('event')
    .sort({ createdAt: -1 });

  res.json(addWaitlistPositions(registrations));
});

const registerForEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const existingRegistration = await Registration.findOne({
    user: req.user._id,
    event: eventId,
  });

  if (existingRegistration) {
    res.status(409);
    throw new Error(
      existingRegistration.status === 'waitlisted'
        ? 'You are already on the waitlist for this event'
        : 'You are already registered for this event'
    );
  }

  const eventWithSeat = await Event.findOneAndUpdate(
    {
      _id: eventId,
      $expr: { $lt: ['$registeredSeats', '$seatLimit'] },
    },
    { $inc: { registeredSeats: 1 } },
    { new: true }
  );

  if (eventWithSeat) {
    const registration = await Registration.create({
      user: req.user._id,
      event: eventId,
      status: 'registered',
    });

    res.status(201).json({
      message: 'Registered successfully',
      registration,
      event: eventWithSeat,
    });
    return;
  }

  const event = await Event.findById(eventId);

  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }

  await Event.findByIdAndUpdate(eventId, { $inc: { waitlistedCount: 1 } });

  try {
    const registration = await Registration.create({
      user: req.user._id,
      event: eventId,
      status: 'waitlisted',
    });

    const updatedEvent = await Event.findById(eventId);

    res.status(201).json({
      message: 'Event is full. You have been added to the waitlist.',
      registration,
      event: updatedEvent,
    });
  } catch (error) {
    await Event.findByIdAndUpdate(eventId, { $inc: { waitlistedCount: -1 } });
    throw error;
  }
});

const cancelRegistration = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const registration = await Registration.findOne({
    user: req.user._id,
    event: eventId,
  });

  if (!registration) {
    res.status(404);
    throw new Error('Registration not found');
  }

  const wasWaitlisted = registration.status === 'waitlisted';
  await registration.deleteOne();

  if (wasWaitlisted) {
    await Event.findByIdAndUpdate(eventId, {
      $inc: { waitlistedCount: -1 },
    });

    res.json({ message: 'Removed from waitlist successfully' });
    return;
  }

  await Event.findByIdAndUpdate(eventId, {
    $inc: { registeredSeats: -1 },
  });

  const nextWaitlisted = await Registration.findOne({
    event: eventId,
    status: 'waitlisted',
  }).sort({ createdAt: 1 });

  if (nextWaitlisted) {
    nextWaitlisted.status = 'registered';
    await nextWaitlisted.save();

    await Event.findByIdAndUpdate(eventId, {
      $inc: { registeredSeats: 1, waitlistedCount: -1 },
    });
  }

  res.json({
    message: nextWaitlisted
      ? 'Registration cancelled. Next waitlisted member was confirmed.'
      : 'Registration cancelled successfully',
  });
});

const submitFeedback = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { rating, feedback } = req.body;

  const registration = await Registration.findOne({
    user: req.user._id,
    event: eventId,
  }).populate('event');

  if (!registration) {
    res.status(404);
    throw new Error('Register for this event before leaving feedback');
  }

  if (registration.status === 'waitlisted') {
    res.status(400);
    throw new Error('Waitlisted members can leave feedback after they are confirmed');
  }

  if (registration.event.date > new Date()) {
    res.status(400);
    throw new Error('Feedback can only be submitted after the event date');
  }

  registration.rating = rating;
  registration.feedback = feedback;
  registration.feedbackSubmittedAt = new Date();
  await registration.save();
  await refreshEventRating(registration.event._id);

  const updatedRegistration = await Registration.findById(registration._id).populate('event');

  res.json({
    message: 'Feedback submitted successfully',
    registration: updatedRegistration,
  });
});

module.exports = {
  listMyRegistrations,
  listAllRegistrations,
  registerForEvent,
  cancelRegistration,
  submitFeedback,
};
