const mongoose = require('mongoose');
const Chat = require('./Chat');
const Report = require('./Report');
const cloudinary = require('../config/cloudinary');


const locationSchema = new mongoose.Schema({
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  stateOrProvince: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  country: { type: String, trim: true },
  isOnline: { type: Boolean, default: false, required: true },
  meetingUrl: {
      type: String,
      trim: true,
      match: [/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/, 'Please provide a valid meeting URL.']
  },
  additionalDetails: { type: String, trim: true, maxlength: 200 }
}, { _id: false });

const eventSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Event title is required.'],
            trim: true,
            maxlength: [150, 'Event title cannot exceed 150 characters.']
        },
        description: {
            type: String,
            required: [true, 'Event description is required.'],
            trim: true,
            maxlength: [2000, 'Event description cannot exceed 2000 characters.']
        },
        coverImage: {
            url: { type: String, default: 'https://res.cloudinary.com/dvtc6coe2/image/upload/v1747676301/event_placeHolder_laziyu.jpg' },
            publicId: { type: String }
        },
        university: {
            type: mongoose.Schema.ObjectId,
            ref: 'University',
            required: [true, 'Event must be associated with a university.'],
            index: true
        },
        startDateTime: {
            type: Date,
            required: [true, 'Event start date and time are required.']
        },
        endDateTime: {
            type: Date,
            required: [true, 'Event end date and time are required.'],
            validate: [
                function(value) {
                    return this.startDateTime <= value;
                },
                'End date/time must be after start date/time.'
            ]
        },
        location: {
            type: locationSchema,
            trim: true,
            required: [true, 'Event location or link is required.']
        },
        eventType: {
            type: String,
            enum: ['workshop', 'seminar', 'conference', 'webinar', 'social', 'career_fair', 'other'],
            required: [true, 'Event type is required.'],
            default: 'other'
        },
        attendees: [
            {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            }
        ],
        maxAttendees: {
            type: Number,
            min: [1, 'Maximum attendees must be at least 1.']
        },
        registrationDeadline: {
             type: Date
        },
        registrationLink: {
          type: String,
          trim: true,
          match: [/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/, 'Please provide a valid registration URL.']
      },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: [true, 'Event must have a creator.'],
            immutable: true
        },
        organizers: [
             {
                 type: mongoose.Schema.ObjectId,
                 ref: 'User'
             }
        ],
        associatedChat: {
            type: mongoose.Schema.ObjectId,
            ref: 'Chat',
            unique: true,
            sparse: true
        },
        status: {
            type: String,
            enum: ['upcoming', 'ongoing', 'past', 'cancelled', 'postponed'],
            default: 'upcoming'
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);


eventSchema.index({ university: 1, startDateTime: 1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ attendees: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ university: 1, title: 1 }, { collation: { locale: 'en', strength: 2 } });


eventSchema.virtual('attendeeCount').get(function() {
    return this.attendees ? this.attendees.length : 0;
});

eventSchema.virtual('isRegistrationOpen').get(function() {
    if (this.registrationDeadline) {
        return new Date() < new Date(this.registrationDeadline);
    }
    return true;
});

eventSchema.virtual('isFull').get(function() {
    if (this.maxAttendees) {
        return (this.attendees ? this.attendees.length : 0) >= this.maxAttendees;
    }
    return false;
});


eventSchema.pre('save', function(next) {
    if (this.isNew) {
        this.organizers.addToSet(this.createdBy);
        // this.attendees.addToSet(this.createdBy); //add creator as attendee??
        console.log(`Creator ${this.createdBy} added as organizer for new event ${this.title}`);
    }

    const now = new Date();
    if (this.status !== 'cancelled' && this.status !== 'postponed') {
        if (this.startDateTime > now) {
            this.status = 'upcoming';
        } else if (this.endDateTime < now) {
            this.status = 'past';
        } else {
            this.status = 'ongoing';
        }
    }

    if (this.location) {
      if (this.location.isOnline && !this.location.meetingUrl) {
          next(new Error('Meeting URL is required for online events.')); return;
      }
      if (!this.location.isOnline && (!this.location.address || !this.location.city || !this.location.country)) {
          next(new Error('Address, city, and country are required for physical events.')); return;
      }
    }

    next();
});


eventSchema.pre('findOneAndDelete', { document: false, query: true }, async function(next) {
    console.log('Event pre-findOneAndDelete hook triggered...');
    const query = this.getQuery();
    const eventId = query._id;

    if (!eventId) return next();

    try {
        const eventToDelete = await mongoose.model('Event').findById(eventId).select('coverImage associatedChat');
        console.log(`Initiating cleanup for event ${eventId}..`);

        const Chat = mongoose.models.Chat || mongoose.model('Chat');
        const Report = mongoose.models.Report || mongoose.model('Report');

        const cleanupPromises = [];

        if (eventToDelete && eventToDelete.associatedChat && Chat) {
            console.log(`Queueing deletion of associated chat ${eventToDelete.associatedChat} for event ${eventId}`);
            cleanupPromises.push(Chat.findByIdAndDelete(eventToDelete.associatedChat));
        }

        if (Report) {
             console.log(`Queueing deletion of reports targeting event ${eventId}`);
             cleanupPromises.push(Report.deleteMany({ targetType: 'Event', targetId: eventId }));
        }

        if (eventToDelete && eventToDelete.coverImage && eventToDelete.coverImage.publicId) {
            console.log(`Queueing deletion of Cloudinary cover image ${eventToDelete.coverImage.publicId}`);
            cleanupPromises.push(
                cloudinary.uploader.destroy(eventToDelete.coverImage.publicId, { resource_type: 'image' })
            );
        }

        await Promise.all(cleanupPromises);
        console.log(`Cleanup tasks completed for event ${eventId}`);
        next();
    } catch (error) {
        console.error(`Error during pre-delete cleanup for event ${eventId}:`, error);
        next(error);
    }
});

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;
