const Event = require('../models/Events');
const { StatusCodes } = require('http-status-codes');
const Joi = require('joi');

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = StatusCodes.NOT_FOUND;
    }
}

class BadRequestError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = StatusCodes.BAD_REQUEST;
    }
}

const eventSchema = Joi.object({
    title: Joi.string().trim().required().max(100),
    description: Joi.string().trim().required().max(500),
    image: Joi.string().uri().required(),
    university: Joi.string().hex().length(24).required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
    time: Joi.date().iso().required(),
    location: Joi.string().uri().required(),
    attendees: Joi.array().items(Joi.string().hex().length(24)).default([])
});

const createEvent = async (req, res) => {
    const { error } = eventSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.details[0].message);
    }
    const event = await Event.create({
        ...req.body,
        createdBy: req.user.id
    });
    res.status(StatusCodes.CREATED).json({ event });
};

const getEvents = async (req, res) => {
    const { page = 1, limit = 10, university, startDate } = req.query;
    const query = {};
    if (university) query.university = university;
    if (startDate) query.startDate = { $gte: new Date(startDate) };

    const events = await Event.find(query)
        .populate('university', 'name logoUrl')
        .populate('attendees', 'username email')
        .populate('createdBy', 'username email')
        .select('-__v')
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
    const total = await Event.countDocuments(query);
    res.status(StatusCodes.OK).json({ events, total, page, limit });
};

const getEventById = async (req, res) => {
    const event = await Event.findByIdAndUpdate(
        req.params.id,
        { $inc: { views: 1 } },
        { new: true }
    )
        .populate('university', 'name logoUrl')
        .populate('attendees', 'username email')
        .populate('createdBy', 'username email')
        .select('-__v');
    if (!event) {
        throw new NotFoundError('Event not found');
    }
    res.status(StatusCodes.OK).json({ event });
};

const updateEvent = async (req, res) => {
    const { error } = eventSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.details[0].message);
    }
    const event = await Event.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    )
        .populate('university', 'name logoUrl')
        .populate('attendees', 'username email')
        .populate('createdBy', 'username email')
        .select('-__v');
    if (!event) {
        throw new NotFoundError('Event not found');
    }
    res.status(StatusCodes.OK).json({ event });
};

const deleteEvent = async (req, res) => {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
        throw new NotFoundError('Event not found');
    }
    res.status(StatusCodes.OK).json({ message: 'Event deleted' });
};

const attendEvent = async (req, res) => {
    const event = await Event.findByIdAndUpdate(
        req.params.id,
        { $addToSet: { attendees: req.user.id } },
        { new: true }
    )
        .populate('university', 'name logoUrl')
        .populate('attendees', 'username email')
        .populate('createdBy', 'username email')
        .select('-__v');
    if (!event) {
        throw new NotFoundError('Event not found');
    }
    res.status(StatusCodes.OK).json({ message: 'Attendance confirmed', event });
};

module.exports = {
    createEvent,
    getEvents,
    getEventById,
    updateEvent,
    deleteEvent,
    attendEvent
};