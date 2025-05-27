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
    const createdBy = req.user.id;
    const coverImageFile = req.file;
    let coverImageData = {}; // Define at the top to avoid reference errors
    
    // Initialize session
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Parse location carefully
        let location;
        try {
            location = req.body.location ? JSON.parse(req.body.location) : {};
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid location data format' 
            });
        }

        // Validate physical event requirements
        if (!location.isOnline) {
            const requiredLocationFields = ['address', 'city', 'country', 'locationUrl'];
            const missingFields = requiredLocationFields.filter(field => !location[field]);
            
            if (missingFields.length > 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ 
                    success: false, 
                    error: `Physical events require: ${missingFields.join(', ')}` 
                });
            }
        }

        // Validate required fields
        const requiredFields = [
            'title', 'description', 'university', 
            'startDateTime', 'endDateTime', 'eventType'
        ];
        
        const missingFields = requiredFields.filter(field => !req.body[field]);
        if (missingFields.length > 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ 
                success: false, 
                error: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        // Validate online event requirements
        if (location.isOnline && !location.meetingUrl) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ 
                success: false, 
                error: 'Meeting URL is required for online events' 
            });
        }

        // Validate university exists
        const uniExists = await University.findById(req.body.university).session(session);
        if (!uniExists) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ 
                success: false, 
                error: `University not found with ID: ${req.body.university}` 
            });
        }

        // Handle cover image upload
        if (coverImageFile) {
            try {
                const resourceType = getResourceTypeFromMime(coverImageFile.mimetype);
                if (resourceType !== 'image') {
                    await session.abortTransaction();
                    session.endSession();
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Cover image must be an image file' 
                    });
                }

                const result = await uploadToCloudinary(
                    coverImageFile.buffer, 
                    coverImageFile.originalname, 
                    'event_covers', 
                    'image'
                );
                coverImageData = { 
                    url: result.secure_url, 
                    publicId: result.public_id 
                };
            } catch (uploadError) {
                await session.abortTransaction();
                session.endSession();
                console.error("Event cover image upload failed:", uploadError);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to upload cover image' 
                });
            }
        }

        // Prepare organizers list
        const organizers = req.body.organizers || [];
        const finalOrganizers = [
            ...new Set([
                createdBy, 
                ...organizers.filter(id => mongoose.Types.ObjectId.isValid(id))
            ])
        ];

        // Create event data
        const eventData = {
            title: req.body.title.trim(),
            description: req.body.description.trim(),
            university: req.body.university,
            startDateTime: req.body.startDateTime,
            endDateTime: req.body.endDateTime,
            location,
            eventType: req.body.eventType,
            maxAttendees: req.body.maxAttendees,
            registrationDeadline: req.body.registrationDeadline,
            registrationLink: req.body.registrationLink?.trim(),
            createdBy,
            organizers: finalOrganizers,
            attendees: [...finalOrganizers],
            ...(coverImageData.url && { coverImage: coverImageData })
        };

        // Create event and associated chat
        const [newEvent] = await Event.create([eventData], { session });
        
        const chatData = {
            name: `Event: ${newEvent.title}`,
            chatType: 'event_chat',
            participants: [...newEvent.attendees],
            event: newEvent._id,
        };
        const [newChat] = await Chat.create([chatData], { session });

        // Update event with chat reference
        newEvent.associatedChat = newChat._id;
        await newEvent.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

        // Populate and return the created event
        const populatedEvent = await Event.findById(newEvent._id)
            .populate('createdBy', 'name profilePicUrl')
            .populate('organizers', 'name profilePicUrl')
            .populate('university', 'name')
            .populate('associatedChat', '_id name')
            .lean();

        console.log(`Event '${newEvent.title}' created successfully`);
        res.status(201).json({ success: true, data: populatedEvent });

    } catch (error) {
        // Handle any errors
        await session.abortTransaction();
        session.endSession();
        console.error("Error creating event:", error);
        
        if (coverImageData?.publicId) {
            try {
                await cloudinary.uploader.destroy(coverImageData.publicId);
            } catch (cleanupError) {
                console.error("Error cleaning up cover image:", cleanupError);
            }
        }
        
        res.status(500).json({ 
            success: false, 
            error: error.message || 'An error occurred while creating the event' 
        });
    }
};


exports.getEvents = async (req, res, next) => {
    const userId = req.user?.id;
    // Removed userUniversity from the filter logic

    const filter = {};
    // Only apply university filter if explicitly requested
    if (req.query.universityId) filter.university = req.query.universityId;

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
  const requestBody = { ...req.body };
  const coverImageFile = req.file;
  const userId = req.user.id;

  // console.log('Update Event Body:', requestBody);
  // console.log('Update Event File:', coverImageFile);

  let event = await Event.findById(eventId);
  if (!event) {
      return res.status(404).json({ success: false, error: `Event not found.` });
  }

  if (!isEventOrganizerOrCreator(event, userId) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to update this event.' });
  }

  const updateData = {};

  const allowedFieldsToUpdate = [
      'title', 'description', 'startDateTime', 'endDateTime',
      'eventType', 'maxAttendees', 'registrationDeadline', 'registrationLink', 'organizers'
  ];

  for (const key of allowedFieldsToUpdate) {
      if (requestBody[key] !== undefined) {
          if (typeof requestBody[key] === 'string') {
              updateData[key] = requestBody[key].trim();
          } else {
              updateData[key] = requestBody[key];
          }
      }
  }

  if (requestBody.organizers && Array.isArray(requestBody.organizers)) {
      updateData.organizers = [
          ...new Set([
              event.createdBy.toString(),
              ...requestBody.organizers.filter(id => mongoose.Types.ObjectId.isValid(id))
          ])
      ];
  }


  if (requestBody.location && typeof requestBody.location === 'string') {
      try {
          updateData.location = JSON.parse(requestBody.location);
          console.log('Parsed location:', updateData.location);
          // TODO: Add validations for lcation elements? we can check if isOnline updated and check required fields...
          if (typeof updateData.location.isOnline !== 'boolean') {
              delete updateData.location;
              console.warn("Location 'isOnline' was invalid after parsing, removing from update.");
          }
      } catch (e) {
          console.warn('Invalid JSON for location, ignoring location update:', e.message);
          return res.status(400).json({ success: false, error: 'Invalid JSON format for location data.' });
      }
  } else if (requestBody.location && typeof requestBody.location === 'object') {
      updateData.location = requestBody.location;
  }

  let oldCoverImagePublicId = event.coverImage?.publicId;
  if (coverImageFile) {
      try {
          const result = await uploadToCloudinary(coverImageFile.buffer, coverImageFile.originalname, 'event_covers', 'image');
          updateData.coverImage = { url: result.secure_url, publicId: result.public_id };
          console.log("New cover image uploaded:", updateData.coverImage.url);
      } catch (uploadError) {
          console.error("Cover image upload failed during update:", uploadError);
      }
  } else if (requestBody.coverImage === null || requestBody.coverImage === '') {
      updateData.coverImage = { url: Event.schema.path('coverImage.url').defaultValue, publicId: null };
      console.log("Cover image flagged for removal.");
  } 

  if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No update data provided.' });
  }

  const updatedEvent = await Event.findByIdAndUpdate(eventId, { $set: updateData }, { new: true, runValidators: true })
      .populate('createdBy organizers university associatedChat', 'name profilePicUrl _id');

  if (!updatedEvent) {
      return res.status(404).json({ success: false, error: 'Event not found during update operation.' });
  }

  if (updateData.coverImage && oldCoverImagePublicId && oldCoverImagePublicId !== updateData.coverImage.publicId) {
      console.log(`Deleting old cover image: ${oldCoverImagePublicId}`);
      cloudinary.uploader.destroy(oldCoverImagePublicId).catch(err => console.error("Cloudinary old image delete error:", err));
  }

  console.log(`Event ${eventId} updated successfully.`);
  res.status(200).json({ success: true, data: updatedEvent });
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
            return res.status(200).json({ success: false, error: 'You are already registered for this event.' });
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


