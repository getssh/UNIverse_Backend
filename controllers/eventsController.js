const Event = require('../models/Event');
const User = require('../models/User');
const University = require('../models/University');
const Chat = require('../models/Chat');
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const { getResourceTypeFromMime } = require('../utils/fileUtils');
const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose');


const isEventOrganizerOrCreator = (event, userId) => {
    const userIdStr = userId.toString();
    const isCreator = event.createdBy.toString() === userIdStr;
    const isOrganizer = event.organizers.some(orgId => orgId.toString() === userIdStr);
    return isCreator || isOrganizer;
};


exports.createEvent = async (req, res, next) => {
    const {
        title, description, university, startDateTime, endDateTime,
        location, eventType, maxAttendees, registrationDeadline, registrationLink, organizers = []
    } = req.body;
    const coverImageFile = req.files?.coverImage?.[0];
    const createdBy = req.user.id;

    if (!title || !description || !university || !startDateTime || !endDateTime || !location || !eventType) {
        return res.status(400).json({ success: false, error: 'Please provide all required event fields.' });
    }

    if (location.isOnline && !location.meetingUrl) {
        return res.status(400).json({ success: false, error: 'Meeting URL is required for online events.' });
    }


    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const uniExists = await University.findById(university).session(session);
        if (!uniExists) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, error: `University not found with ID: ${university}` });
        }

        let coverImageData = {};
        if (coverImageFile) {
            try {
                const resourceType = getResourceTypeFromMime(coverImageFile.mimetype);
                if (resourceType !== 'image') {
                    await session.abortTransaction(); session.endSession();
                    return res.status(400).json({ success: false, error: 'Cover image must be an image file.' });
                }
                const result = await uploadToCloudinary(
                    coverImageFile.buffer, coverImageFile.originalname, 'event_covers', 'image'
                );
                coverImageData = { url: result.secure_url, publicId: result.public_id };
            } catch (uploadError) {
                await session.abortTransaction(); session.endSession();
                console.error("Event cover image upload failed:", uploadError);
                return res.status(500).json({ success: false, error: `Failed to upload cover image: ${uploadError.message}` });
            }
        }


        const finalOrganizers = [...new Set([createdBy, ...organizers.filter(id => mongoose.Types.ObjectId.isValid(id))])];


        const eventData = {
            title: title.trim(),
            description: description.trim(),
            coverImage: coverImageData.url ? coverImageData : undefined,
            university,
            startDateTime,
            endDateTime,
            location,
            eventType,
            maxAttendees,
            registrationDeadline,
            registrationLink: registrationLink?.trim(),
            createdBy,
            organizers: finalOrganizers,
            attendees: [createdBy, ...finalOrganizers],
        };

        const newEventArray = await Event.create([eventData], { session });
        let newEvent = newEventArray[0];

        const chatData = {
            name: `Event: ${newEvent.title}`,
            chatType: 'event_chat',
            participants: [...newEvent.attendees],
            event: newEvent._id,
        };
        const newChatArray = await Chat.create([chatData], { session });
        const newChat = newChatArray[0];


        newEvent.associatedChat = newChat._id;
        await newEvent.save({ session });


        await session.commitTransaction();
        session.endSession();

        console.log(`Event '${newEvent.title}' and associated chat ${newChat._id} created successfully.`);

        newEvent = await Event.findById(newEvent._id)
            .populate('createdBy', 'name profilePicUrl')
            .populate('organizers', 'name profilePicUrl')
            .populate('university', 'name')
            .populate('associatedChat', '_id name')
            .lean();

        res.status(201).json({ success: true, data: newEvent });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error creating event or associated chat:", error);
        if (coverImageData.publicId) cloudinary.uploader.destroy(coverImageData.publicId).catch(console.error);
        next(error);
    }
};


exports.getEvents = async (req, res, next) => {
    const userId = req.user?.id;
    const userUniversity = req.user?.university;

    const filter = {};
    if (req.query.universityId) filter.university = req.query.universityId;
    else if (userUniversity) filter.university = userUniversity;

    if (req.query.eventType) filter.eventType = req.query.eventType;
    if (req.query.status) filter.status = req.query.status;
    else filter.status = { $in: ['upcoming', 'ongoing'] };

    if (req.query.isOnline) filter['location.isOnline'] = req.query.isOnline === 'true';
    if (req.query.search) {
        filter.$or = [
            { title: { $regex: req.query.search, $options: 'i' } },
            { description: { $regex: req.query.search, $options: 'i' } }
        ];
    }
    
    if (req.query.dateRange === 'next7days') {
         const today = new Date();
         const nextWeek = new Date(today);
         nextWeek.setDate(today.getDate() + 7);
         filter.startDateTime = { $gte: today, $lte: nextWeek };
    } else if (req.query.startDate && req.query.endDate) {
         filter.startDateTime = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };
    }


    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    let sort = { startDateTime: 1 };
    if (req.query.sort === 'attendees') sort = { attendeeCountVirtual: -1 };
    else if (req.query.sort === 'newest') sort = { createdAt: -1 };


    const events = await Event.find(filter)
        .populate('createdBy', 'name profilePicUrl')
        .populate('university', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

    events.forEach(event => {
        event.attendeeCount = event.attendees ? event.attendees.length : 0;
    });

    const totalEvents = await Event.countDocuments(filter);
    const totalPages = Math.ceil(totalEvents / limit);

    res.status(200).json({
        success: true,
        count: events.length,
        pagination: { totalEvents, totalPages, currentPage: page, limit },
        data: events
    });
};


exports.getEventById = async (req, res, next) => {
    const { eventId } = req.params;

    const event = await Event.findById(eventId)
        .populate('createdBy', 'name profilePicUrl email')
        .populate('organizers', 'name profilePicUrl')
        .populate('university', 'name location')
        .populate('associatedChat', '_id name')
        .lean();

    if (!event) {
        return res.status(404).json({ success: false, error: `Event not found with ID: ${eventId}` });
    }

    event.attendeeCount = event.attendees ? event.attendees.length : 0;
    event.isFull = event.maxAttendees ? event.attendeeCount >= event.maxAttendees : false;
    event.isRegistrationOpen = event.registrationDeadline ? new Date() < new Date(event.registrationDeadline) : true;


    res.status(200).json({ success: true, data: event });
};


exports.updateEvent = async (req, res, next) => {
    const { eventId } = req.params;
    const updateData = { ...req.body };
    const coverImageFile = req.files?.coverImage?.[0];
    const userId = req.user.id;

    let event = await Event.findById(eventId);
    if (!event) {
        return res.status(404).json({ success: false, error: `Event not found.` });
    }

    if (!isEventOrganizerOrCreator(event, userId) && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Not authorized to update this event.' });
    }

    delete updateData.createdBy;
    delete updateData.attendees;
    delete updateData.associatedChat;
    delete updateData.university;


    let oldCoverImagePublicId = event.coverImage?.publicId;
    if (coverImageFile) {
        try {
            const result = await uploadToCloudinary(coverImageFile.buffer, coverImageFile.originalname, 'event_covers', 'image');
            updateData.coverImage = { url: result.secure_url, publicId: result.public_id };
        } catch (uploadError) { console.error(uploadError); }
    } else if (updateData.coverImage === null || updateData.coverImage === '') {
        updateData.coverImage = { url: Event.schema.path('coverImage.url').defaultValue, publicId: null };
    }


     if (updateData.organizers && Array.isArray(updateData.organizers)) {
         updateData.organizers = [...new Set([event.createdBy.toString(), ...updateData.organizers.filter(id => mongoose.Types.ObjectId.isValid(id))])];
     } else {
         delete updateData.organizers;
     }


    event = await Event.findByIdAndUpdate(eventId, { $set: updateData }, { new: true, runValidators: true })
        .populate('createdBy organizers university associatedChat', 'name profilePicUrl _id');


    if (updateData.coverImage && oldCoverImagePublicId && oldCoverImagePublicId !== updateData.coverImage.publicId) {
        cloudinary.uploader.destroy(oldCoverImagePublicId).catch(console.error);
    }

    res.status(200).json({ success: true, data: event });
};


exports.deleteEvent = async (req, res, next) => {
    const { eventId } = req.params;
    const userId = req.user.id;

    const event = await Event.findById(eventId);
    if (!event) {
        return res.status(404).json({ success: false, error: `Event not found.` });
    }

    if (!isEventOrganizerOrCreator(event, userId) && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this event.' });
    }

    await Event.findByIdAndDelete(eventId);

    res.status(200).json({ success: true, message: 'Event deleted successfully.' });
};


exports.toggleEventAttendance = async (req, res, next) => {
    const { eventId } = req.params;
    const userId = req.user.id;

    const event = await Event.findById(eventId).populate('associatedChat', '_id');
    if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found.' });
    }
    if (event.status === 'past' || event.status === 'cancelled') {
        return res.status(400).json({ success: false, error: `Cannot manage attendance for a ${event.status} event.`});
    }


    const isAttending = event.attendees.some(attendeeId => attendeeId.equals(userId));
    let updatedEvent;
    let message;

    if (req.method === 'POST') {
        if (isAttending) {
            return res.status(400).json({ success: false, error: 'You are already registered for this event.' });
        }
        if (event.isFull) {
            return res.status(400).json({ success: false, error: 'This event has reached its maximum attendee limit.' });
        }
        if (!event.isRegistrationOpen) {
            return res.status(400).json({ success: false, error: 'Event registration is closed.' });
        }

        updatedEvent = await Event.findByIdAndUpdate(
            eventId,
            { $addToSet: { attendees: userId } },
            { new: true }
        );
        message = 'Successfully registered for the event.';

        //should the chat particpants be attendees or any users who have joined the chat?
        if (updatedEvent && updatedEvent.associatedChat) {
            await Chat.findByIdAndUpdate(updatedEvent.associatedChat, { $addToSet: { participants: userId } });
        }

    } else if (req.method === 'DELETE') {
        if (!isAttending) {
            return res.status(400).json({ success: false, error: 'You are not registered for this event.' });
        }
        updatedEvent = await Event.findByIdAndUpdate(
            eventId,
            { $pull: { attendees: userId } },
            { new: true }
        );
        message = 'Successfully unregistered from the event.';

        //should the chat particpants be attendees or any users who have joined the chat?
        if (updatedEvent && updatedEvent.associatedChat) {
            await Chat.findByIdAndUpdate(updatedEvent.associatedChat, { $pull: { participants: userId } });
        }
    } else {
        return res.status(405).json({ success: false, error: 'Method not allowed.'});
    }

    if (!updatedEvent) {
         return res.status(404).json({ success: false, error: 'Event not found during attendance update.'});
    }

    res.status(200).json({ success: true, message, data: { attendeeCount: updatedEvent.attendees.length } });
};


exports.getEventAttendees = async (req, res, next) => {
    const { eventId } = req.params;
    const userId = req.user?.id;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const event = await Event.findById(eventId).select('attendees createdBy organizers university');
    if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found.' });
    }

    const isOrganizerOrCreator = isEventOrganizerOrCreator(event, userId);
    const isSameUniversity = event.university.equals(req.user.university);
    if (!isOrganizerOrCreator && !isSameUniversity && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Not authorized to view attendees for this event.' });
    }


    const attendeeIds = event.attendees.slice(skip, skip + limit);
    const attendees = await User.find({ '_id': { $in: attendeeIds } })
        .select('name profilePicUrl email')
        .lean();

    const totalAttendees = event.attendees.length;
    const totalPages = Math.ceil(totalAttendees / limit);

    res.status(200).json({
        success: true,
        count: attendees.length,
        pagination: { totalAttendees, totalPages, currentPage: page, limit },
        data: attendees
    });
};
