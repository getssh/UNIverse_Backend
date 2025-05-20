const mongoose = require('mongoose');
const Group = require('./Group');
const Event = require('./Event');
const Channel = require('./Channel');
const User = require('./User');
const cloudinary = require('../config/cloudinary');

const universitySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'University name is required.'],
            unique: true,
            trim: true,
            maxlength: [150, 'University name cannot exceed 150 characters.']
        },
        description: {
            type: String,
            trim: true,
            maxlength: [1000, 'University description cannot exceed 1000 characters.']
        },
        location: {
            type: String,
            trim: true,
            maxlength: [200, 'Location cannot exceed 200 characters.']
        },
        websiteUrl: {
            type: String,
            trim: true,
            match: [/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/, 'Please provide a valid website URL.']
        },
        logo: {
            url: {
                 type: String,
                 trim: true,
                 default: 'https://res.cloudinary.com/dvtc6coe2/image/upload/v1747590439/channel_pro_placeholder_wduo6q.png'
            },
            publicId: { type: String }
        },
        contactEmail: {
             type: String,
             trim: true,
             lowercase: true,
             match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid contact email address.']
        },
        contactPhone: {
            type: String,
            trim: true
        },
        universityAdmins: [
            {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            }
        ],
        status: {
            type: String,
            enum: ['pending_approval', 'active', 'suspended', 'inactive'],
            default: 'pending_approval',
            index: true
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);


universitySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
universitySchema.index({ universityAdmins: 1 });



universitySchema.virtual('adminCount').get(function() {
    return this.universityAdmins ? this.universityAdmins.length : 0;
});


universitySchema.pre('findOneAndDelete', { document: false, query: true }, async function(next) {
    console.log('University pre-findOneAndDelete hook triggered...');
    const query = this.getQuery();
    const universityId = query._id;

    if (!universityId) return next();

    try {
        const uniToDelete = await mongoose.model('University').findById(universityId).select('logo');
 
        const User = mongoose.models.User || mongoose.model('User');
        const Channel = mongoose.models.Channel || mongoose.model('Channel');
        const Event = mongoose.models.Event || mongoose.model('Event');

        const cleanupPromises = [];
        cleanupPromises.push(User.updateMany({ university: universityId }, { $set: { university: null } }));

        const channels = await Channel.find({ university: universityId });
        for (const channel of channels) {
            cleanupPromises.push(Channel.findByIdAndDelete(channel._id)); 
        }
        const events = await Event.find({ university: universityId });
        for (const event of events) {
            cleanupPromises.push(Event.findByIdAndDelete(event._id));
        }

        if (uniToDelete && uniToDelete.logo && uniToDelete.logo.publicId) {
            const cloudinary = require('../config/cloudinary');
            console.log(`Queueing deletion of university logo ${uniToDelete.logo.publicId}`);
            cleanupPromises.push(
                cloudinary.uploader.destroy(uniToDelete.logo.publicId, { resource_type: 'image' })
            );
        }

        await Promise.all(cleanupPromises);
        console.log(`Cleanup tasks completed for university ${universityId}`);
        next();
    } catch (error) {
        console.error(`Error during pre-delete cleanup for university ${universityId}:`, error);
        next(error);
    }
});


const University = mongoose.model('University', universitySchema);
module.exports = University;
