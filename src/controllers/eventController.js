const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const asyncHandler = require('../utils/asyncHandler');

const inferCategoryExpression = {
  $let: {
    vars: {
      loweredCategory: { $toLower: { $ifNull: ['$category', ''] } },
      text: {
        $toLower: {
          $concat: [
            { $ifNull: ['$title', ''] },
            ' ',
            { $ifNull: ['$description', ''] },
          ],
        },
      },
    },
    in: {
      $switch: {
        branches: [
          { case: { $ne: ['$$loweredCategory', ''] }, then: '$$loweredCategory' },
          { case: { $regexMatch: { input: '$$text', regex: 'tech|development|code|ai|web' } }, then: 'tech' },
          { case: { $regexMatch: { input: '$$text', regex: 'fest|festival|cultural|carnival' } }, then: 'fest' },
          { case: { $regexMatch: { input: '$$text', regex: 'sports|sport|cricket|football|tournament|match|fitness' } }, then: 'sports' },
          { case: { $regexMatch: { input: '$$text', regex: 'business|startup|networking|finance|marketing|pitch' } }, then: 'business' },
          { case: { $regexMatch: { input: '$$text', regex: 'fun|games|party|music' } }, then: 'fun' },
        ],
        default: 'general',
      },
    },
  },
};

const attachFeedbackToEvents = async (events) => {
  const eventIds = events.map((event) => event._id);

  if (eventIds.length === 0) {
    return events;
  }

  const feedbackRows = await Registration.find({
    event: { $in: eventIds },
    $or: [{ status: 'registered' }, { status: { $exists: false } }],
    rating: { $type: 'number' },
  })
    .populate('user', 'name')
    .sort({ feedbackSubmittedAt: -1, createdAt: -1 });

  const feedbackMap = new Map();
  const waitlistCounts = await Registration.aggregate([
    {
      $match: {
        event: { $in: eventIds },
        status: 'waitlisted',
      },
    },
    {
      $group: {
        _id: '$event',
        value: { $sum: 1 },
      },
    },
  ]);

  const waitlistMap = new Map(waitlistCounts.map((entry) => [String(entry._id), entry.value]));

  feedbackRows.forEach((registration) => {
    const key = String(registration.event);
    const current = feedbackMap.get(key) || [];

    if (registration.feedback || registration.rating) {
      current.push({
        id: registration._id,
        rating: registration.rating,
        feedback: registration.feedback,
        userName: registration.user?.name || 'Anonymous',
        submittedAt: registration.feedbackSubmittedAt || registration.updatedAt,
      });
    }

    feedbackMap.set(key, current);
  });

  return events.map((event) => {
    const key = String(event._id);
    return {
      ...event.toObject(),
      feedbackList: feedbackMap.get(key) || [],
      waitlistCount: waitlistMap.get(key) || 0,
    };
  });
};

const listEvents = asyncHandler(async (req, res) => {
  const { search, location, category, startDate, endDate } = req.query;
  const query = {};

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } },
    ];
  }

  if (location) {
    query.location = { $regex: location, $options: 'i' };
  }

  if (category) {
    query.category = category.toLowerCase();
  }

  if (startDate || endDate) {
    query.date = {};

    if (startDate) {
      query.date.$gte = new Date(startDate);
    }

    if (endDate) {
      query.date.$lte = new Date(endDate);
    }
  }

  const events = await Event.find(query).sort({ date: 1 });
  const eventsWithFeedback = await attachFeedbackToEvents(events);
  res.json({ events: eventsWithFeedback });
});

const getEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }

  const [eventWithFeedback] = await attachFeedbackToEvents([event]);
  res.json({ event: eventWithFeedback });
});

const createEvent = asyncHandler(async (req, res) => {
  const event = await Event.create(req.body);
  res.status(201).json({ event });
});

const updateEvent = asyncHandler(async (req, res) => {
  const currentEvent = await Event.findById(req.params.id);

  if (!currentEvent) {
    res.status(404);
    throw new Error('Event not found');
  }

  if (Number(req.body.seatLimit) < currentEvent.registeredSeats) {
    res.status(400);
    throw new Error('Seat limit cannot be lower than current registrations');
  }

  const event = await Event.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({ event });
});

const deleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    res.status(404);
    throw new Error('Event not found');
  }

  await Registration.deleteMany({ event: event._id });
  await event.deleteOne();

  res.json({ message: 'Event deleted' });
});

const getAnalytics = asyncHandler(async (req, res) => {

  const totalUsers = await User.countDocuments();
  const totalEvents = await Event.countDocuments();
  const totalRegistrations = await Registration.countDocuments({
    $or: [{ status: 'registered' }, { status: { $exists: false } }],
  });
  const totalWaitlisted = await Registration.countDocuments({ status: 'waitlisted' });

  const categoryBreakdown = await Event.aggregate([
    {
      $project: {
        derivedCategory: inferCategoryExpression,
      },
    },
    {
      $group: {
        _id: '$derivedCategory',
        value: { $sum: 1 },
      },
    },
    { $sort: { value: -1, _id: 1 } },
  ]);

  const registrationByCategory = await Registration.aggregate([
    {
      $match: {
        $or: [{ status: 'registered' }, { status: { $exists: false } }],
      },
    },
    {
      $lookup: {
        from: "events",
        localField: "event",
        foreignField: "_id",
        as: "event"
      }
    },
    { $unwind: "$event" },
    {
      $project: {
        derivedCategory: {
          $let: {
            vars: {
              loweredCategory: { $toLower: { $ifNull: ['$event.category', ''] } },
              text: {
                $toLower: {
                  $concat: [
                    { $ifNull: ['$event.title', ''] },
                    ' ',
                    { $ifNull: ['$event.description', ''] },
                  ],
                },
              },
            },
            in: {
              $switch: {
                branches: [
                  { case: { $ne: ['$$loweredCategory', ''] }, then: '$$loweredCategory' },
                  { case: { $regexMatch: { input: '$$text', regex: 'tech|development|code|ai|web' } }, then: 'tech' },
                  { case: { $regexMatch: { input: '$$text', regex: 'fest|festival|cultural|carnival' } }, then: 'fest' },
                  { case: { $regexMatch: { input: '$$text', regex: 'sports|sport|cricket|football|tournament|match|fitness' } }, then: 'sports' },
                  { case: { $regexMatch: { input: '$$text', regex: 'business|startup|networking|finance|marketing|pitch' } }, then: 'business' },
                  { case: { $regexMatch: { input: '$$text', regex: 'fun|games|party|music' } }, then: 'fun' },
                ],
                default: 'general',
              },
            },
          },
        },
      },
    },
    {
      $group: {
        _id: '$derivedCategory',
        value: { $sum: 1 },
      },
    },
    { $sort: { value: -1, _id: 1 } },
  ]);

  const feedbackSummaryAgg = await Registration.aggregate([
    { $match: { rating: { $type: 'number' } } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        feedbackCount: { $sum: 1 },
      },
    },
  ]);

  const popularAgg = await Registration.aggregate([
    {
      $match: {
        $or: [{ status: 'registered' }, { status: { $exists: false } }],
      },
    },
    {
      $group: {
        _id: "$event",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ]);

  let mostPopularEvent = null;
  if (popularAgg.length > 0) {
    const event = await Event.findById(popularAgg[0]._id);
    if (event) mostPopularEvent = event;
  }

  const topRatedAgg = await Registration.aggregate([
    { $match: { rating: { $type: 'number' } } },
    {
      $group: {
        _id: '$event',
        avg: { $avg: '$rating' },
      },
    },
    { $sort: { avg: -1 } },
    { $limit: 1 },
  ]);

  let topRatedEvent = null;
  if (topRatedAgg.length > 0) {
    const event = await Event.findById(topRatedAgg[0]._id);
    if (event) {
      topRatedEvent = {
        ...event.toObject(),
        averageRating: Number(topRatedAgg[0].avg.toFixed(1))
      };
    }
  }

  res.json({
    analytics: {
      totalUsers,
      totalEvents,
      totalRegistrations,
      mostPopularEvent,
      topRatedEvent,
      categoryBreakdown,
      registrationByCategory,
      feedbackSummary: feedbackSummaryAgg[0] || {
        averageRating: 0,
        feedbackCount: 0,
      },
      totalWaitlisted,
    },
  });
});

module.exports = {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getAnalytics,
};
