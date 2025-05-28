const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');


const {
    createEvent,
    getEvents,
    getEventById,
    updateEvent,
    deleteEvent,
    toggleEventAttendance,
    getEventAttendees
} = require('../controllers/eventController');


const { protect, authorize } = require('../middleware/authMiddleware');

const Event = require('../models/Event');
const eventTypes = Event.schema.path('eventType').enumValues;
const eventStatuses = Event.schema.path('status').enumValues;


const router = express.Router();

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload only images for the event cover.'), false);
    }
};
const uploadCoverImage = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});


const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    const extractedErrors = errors.array().map(err => ({
        field: err.param || err.location || (err.nestedErrors ? err.nestedErrors[0]?.param : 'unknown'),
        message: err.msg
    }));
    return res.status(422).json({ success: false, errors: extractedErrors });
};


const eventIdValidation = [param('eventId', 'Invalid Event ID format').isMongoId()];

const eventBodyValidation = [
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty.')
               .isLength({ max: 150 }).withMessage('Title cannot exceed 150 characters.'),
    body('description').optional().trim().notEmpty().withMessage('Description cannot be empty.')
                     .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters.'),
    body('university').optional().isMongoId().withMessage('Invalid University ID format.'),
    body('startDateTime').optional().isISO8601().toDate().withMessage('Invalid start date/time format.'),
    body('endDateTime').optional().isISO8601().toDate().withMessage('Invalid end date/time format.')
        .custom((value, { req }) => {
            if (req.body.startDateTime && value < req.body.startDateTime) {
                throw new Error('End date/time must be after start date/time.');
            }
            return true;
        }),
   
    // body('location').optional().isObject().withMessage('Location must be an object.'),
    body('location.address').optional({ checkFalsy: true }).trim().isString(),
    body('location.city').optional({ checkFalsy: true }).trim().isString(),
    body('location.stateOrProvince').optional({ checkFalsy: true }).trim().isString(),
    body('location.postalCode').optional({ checkFalsy: true }).trim().isString(),
    body('location.country').optional({ checkFalsy: true }).trim().isString(),
    body('location.isOnline').optional().isBoolean().withMessage('location.isOnline must be true or false.'),
    body('location.meetingUrl').optional({ checkFalsy: true }).trim().isURL().withMessage('Invalid meeting URL.'),
    body('location.additionalDetails').optional({ checkFalsy: true }).trim().isString().isLength({max: 200}),

    body('eventType').optional().isIn(eventTypes).withMessage(`Invalid event type. Allowed: ${eventTypes.join(', ')}`),
    body('maxAttendees').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Max attendees must be a positive integer.'),
    body('registrationDeadline').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('Invalid registration deadline format.'),
    body('registrationLink').optional({ checkFalsy: true }).trim().isURL().withMessage('Invalid registration link URL.'),
    body('organizers').optional().isArray().withMessage('Organizers must be an array.'),
    body('organizers.*').optional().isMongoId().withMessage('Each organizer ID must be a valid MongoDB ObjectId.')
];


const createEventBodyValidation = [
    body('title', 'Title is required.').trim().notEmpty(),
    body('description', 'Description is required.').trim().notEmpty(),
    body('university', 'University ID is required.').isMongoId(),
    body('startDateTime', 'Start date/time is required.').isISO8601().toDate(),
    body('endDateTime', 'End date/time is required.').isISO8601().toDate(),
    // body('location', 'Location details are required.').notEmpty().isObject(),
    // body('location.isOnline', 'location.isOnline (true/false) is required.').isBoolean(),
    body().custom((value, {req}) => {
        if (req.body.location?.isOnline === true && !req.body.location?.meetingUrl) {
            throw new Error('Meeting URL is required for online events.');
        }
        if (req.body.location?.isOnline === false && !req.body.location?.address) {
            throw new Error('Address is required for physical events.');
        }
        return true;
    }),
    body('eventType', 'Event type is required.').isIn(eventTypes)
];


const getEventsQueryValidation = [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('universityId').optional().isMongoId(),
    query('eventType').optional().isIn(eventTypes),
    query('status').optional().isIn(eventStatuses),
    query('isOnline').optional().isBoolean().toBoolean(),
    query('search').optional().trim().escape(),
    query('dateRange').optional().isIn(['next7days']),
    query('startDate').optional().isISO8601().toDate(),
    query('endDate').optional().isISO8601().toDate(),
    query('sort').optional().isIn(['attendees', 'newest', 'startDateTime'])
];


const getAttendeesQueryValidation = [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
];



/**
 * @route   POST api/events
 * @desc    Create a new event
 * @access  Private
 */
router.route('/')
    .post(
        protect,
        // authorize(['admin']),
        uploadCoverImage.single('coverImage'),
        createEventBodyValidation,
        eventBodyValidation,
        handleValidationErrors,
        createEvent
    )

/**
 * @route   GET api/events
 * @desc    Get events
 * @access  Private
 */
    .get(
        protect,
        getEventsQueryValidation,
        handleValidationErrors,
        getEvents
    );


/**
 * @route   GET api/events/:eventId
 * @desc    Get an event by ID
 * @access  Private
 */
router.route('/:eventId')
    .get(
        protect,
        eventIdValidation,
        handleValidationErrors,
        getEventById
    )

/**
 * @route   PUT api/events/:eventId
 * @desc    Update an event
 * @access  Private
 */
    .put(
        protect,
        uploadCoverImage.single('coverImage'),
        eventIdValidation,
        eventBodyValidation,
        handleValidationErrors,
        updateEvent
    )

/**
 * @route   DELETE api/events/:eventId
 * @desc    Delete an event
 * @access  Private
 */
    .delete(
        protect,
        authorize(['admin']),
        eventIdValidation,
        handleValidationErrors,
        deleteEvent
    );


/**
 * @route   POST api/events/:eventId/attend
 * @desc    Attend an event
 * @access  Private
 */
router.route('/:eventId/attend')
    .post(
        protect,
        eventIdValidation,
        handleValidationErrors,
        toggleEventAttendance
    )

/**
 * @route   DELETE api/events/:eventId/attend
 * @desc    Leave an event
 * @access  Private
 */
    .delete(
        protect,
        eventIdValidation,
        handleValidationErrors,
        toggleEventAttendance
    );


/**
 * @route   GET api/events/:eventId/attendees
 * @desc    Get event attendees
 * @access  Private
 */
router.get(
    '/:eventId/attendees',
    protect,
    eventIdValidation,
    getAttendeesQueryValidation,
    handleValidationErrors,
    getEventAttendees
);


module.exports = router;
