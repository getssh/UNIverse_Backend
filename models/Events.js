const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Event title is required'],
        trim: true,
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Event description is required'],
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    image: {
        type: String,
        required: [true, 'Event image URL is required'],
        trim: true
    },
    university: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'University',
        required: [true, 'University is required']
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required']
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required'],
        validate: {
            validator: function (value) {
                return this.startDate <= value;
            },
            message: 'End date must be after start date'
        }
    },
    time: {
        type: Date,
        required: [true, 'Event time is required']
    },
    location: {
        type: String,
        required: [true, 'Location URL is required'],
        trim: true,
        match: [/^https?:\/\/[^\s$.?#].[^\s]*$/, 'Please provide a valid URL']
    },
    attendees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: []
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Event creator is required']
    },
    views: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true }
});

// Virtual for attendee count
eventSchema.virtual('attendeeCount').get(function () {
    return this.attendees.length;
});

// Sanitize inputs
eventSchema.pre('validate', function (next) {
    this.title = sanitizeHtml(this.title, { allowedTags: [], allowedAttributes: {} });
    this.description = sanitizeHtml(this.description, { allowedTags: [], allowedAttributes: {} });
    next();
});

// Indexes for performance
eventSchema.index({ university: 1 });
eventSchema.index({ startDate: 1 });

// Prevent OverwriteModelError
module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);