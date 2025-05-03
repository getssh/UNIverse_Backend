const mongoose = require('mongoose');
const Post = require('./Post'); 
// const Report = require('./Report');
const cloudinary = require('../config/cloudinary');
const path = require('path');

const channelSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Channel name cannot be empty.'],
            trim: true,
            maxlength: [100, 'Channel name cannot exceed 100 characters.']
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Channel description cannot exceed 500 characters.']
        },
        profilePic: {
            url: {
                 type: String,
                 default: 'URL_TO_DEFAULT_CHANNEL_ICON_PLACEHOLDER'
            },
            publicId: { type: String }
        },
        university: {
            type: mongoose.Schema.ObjectId,
            ref: 'University',
            required: [true, 'Channel must belong to a university.'],
            index: true
        },
        admin: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
        },
        channelType: {
            type: String,
            required: [true, 'Please specify the channel type.'],
            enum: ['general', 'official', 'departmental', 'course', 'club', 'announcement', 'other'],
            default: 'general'
        },
        members: [
             {
                 type: mongoose.Schema.ObjectId,
                 ref: 'User'
             }
        ],
        isPublic: {
             type: Boolean,
             default: true
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

channelSchema.index({ university: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
channelSchema.index({ members: 1 });


channelSchema.virtual('memberCount').get(function() {
    return this.members ? this.members.length : 0;
});

channelSchema.pre('save', function(next) {
    if (this.isNew && this.admin) {
        this.members.addToSet(this.admin);
        console.log(`Admin ${this.admin} added to members of new channel ${this.name}`);
    }
    next();
});

channelSchema.pre('findOneAndUpdate', async function(next) {
    const update = this.getUpdate();

    if (update.$set && update.$set.admin) {
        const newAdminId = update.$set.admin;

        this.updateOne({}, { $addToSet: { members: newAdminId } });
        console.log(`New admin ${newAdminId} being added to members via findOneAndUpdate hook.`);
    }

    next();
});


channelSchema.pre('findOneAndDelete', { document: false, query: true }, async function(next) {
    console.log('Channel pre-findOneAndDelete hook triggered...');
    const query = this.getQuery();
    const channelId = query._id;

    if (!channelId) {
        console.warn('Channel ID not found in query for findOneAndDelete hook. Skipping cleanup.');
        return next();
    }

    try {
        const channelToDelete = await mongoose.model('Channel').findById(channelId).select('profilePic');

        console.log(`Initiating cleanup for channel ${channelId}...`);
        const Post = mongoose.models.Post || mongoose.model('Post');
        const Report = mongoose.models.Report || mongoose.model('Report');

        const cleanupPromises = [];

        console.log(`Queueing unlinking of posts for channel ${channelId}`);
        cleanupPromises.push(
            Post.updateMany({ channel: channelId }, { $set: { channel: null } })
                .then(result => console.log(`Unlinked ${result.modifiedCount} posts.`))
        );

        if (Report) {
             console.log(`Queueing deletion of reports targeting channel ${channelId}`);
             cleanupPromises.push(Report.deleteMany({ targetType: 'channel', targetId: channelId }));
        } else {
             console.warn("Report model not found, skipping report deletion for channel.");
        }

        if (channelToDelete && channelToDelete.profilePic && channelToDelete.profilePic.publicId) {
            console.log(`Queueing deletion of Cloudinary profile picture ${channelToDelete.profilePic.publicId}`);
            cleanupPromises.push(
                cloudinary.uploader.destroy(channelToDelete.profilePic.publicId, { resource_type: 'image' })
                    .then(result => console.log(`Cloudinary deletion result for ${channelToDelete.profilePic.publicId}:`, result))
                    .catch(err => console.error(`Failed to delete ${channelToDelete.profilePic.publicId} from Cloudinary:`, err))
            );
        }

        await Promise.all(cleanupPromises);
        console.log(`Cleanup tasks completed for channel ${channelId}`);
        next();

    } catch (error) {
        console.error(`Error during pre-delete cleanup for channel ${channelId}:`, error);
        next(error);
    }
});

const Channel = mongoose.model('Channel', channelSchema);

module.exports = Channel;
