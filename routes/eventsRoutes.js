const express = require('express');
const router = express.Router();
const {
    createEvent,
    getEvents,
    getEventById,
    updateEvent,
    deleteEvent,
    attendEvent
} = require('../controllers/eventsController');
const { protect, authorize } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per IP
});

router.route('/events')
    .get(limiter, getEvents)
    .post(protect, authorize(['admin'], { modelName: 'Event', paramName: 'id', userField: 'createdBy' }), createEvent);

router.route('/events/:id')
    .get(getEventById)
    .put(protect, authorize(['admin'], { modelName: 'Event', paramName: 'id', userField: 'createdBy' }), updateEvent)
    .delete(protect, authorize(['admin'], { modelName: 'Event', paramName: 'id', userField: 'createdBy' }), deleteEvent);

router.route('/events/:id/attend')
    .post(protect, attendEvent);

module.exports = router;