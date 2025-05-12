const mongoose = require('mongoose');
const User = require('./User');
const Post = require('./Post');
const Report = require('./Report');
const Chat = require('./Chat');
const cloudinary = require('../config/cloudinary');

const groupSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Group name cannot be empty.'],
            trim: true,
            unique: true,
            maxlength: [100, 'Group name cannot exceed 100 characters.']
        },
        description: {
            type: String,
            trim: true,
            maxlength: [1000, 'Group description cannot exceed 1000 characters.']
        },
        profilePic: {
            url: { type: String, default: 'URL_TO_DEFAULT_GROUP_ICON_PLACEHOLDER' },
            publicId: { type: String }
        },
        coverPhoto: {
            url: { type: String, default: 'URL_TO_DEFAULT_GROUP_COVER_PLACEHOLDER' },
            publicId: { type: String }
        },
        createdBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: [true, 'Group must have a creator.'],
            immutable: true //maybe allow to change owner like tg?
        },
        admins: [
            {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            }
        ],
        moderators: [
            {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            }
        ],
        members: [
            {
                type: mongoose.Schema.ObjectId,
                ref: 'User'
            }
        ],
        groupType: {
            type: String,
            required: [true, 'Please specify the group type.'],
            enum: ['student', 'faculty', 'general', 'course_specific', 'club_organization', 'other'],
            default: 'general'
        },
        privacy: {
            type: String,
            required: [true, 'Please specify group privacy.'],
            enum: ['public', 'private', 'university_only', 'faculty_only', 'students_only'],
            default: 'public'
        },
        university: { //maybe we dont need to associate groups with university?
            type: mongoose.Schema.ObjectId,
            ref: 'University',
            index: true
        },
        rules: [{
            type: String,
            trim: true,
            maxlength: [500, 'Rule cannot exceed 500 characters.']
        }],
        tags: [{
            type: String,
            trim: true,
            lowercase: true
        }],
        status: {
            type: String,
            enum: ['active', 'inactive', 'archived', 'under_review'],
            default: 'active'
        },
        joinRequests: [
          {
              user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },
              requestedAt: { type: Date, default: Date.now },
              message: { type: String, trim: true, maxlength: 200 }
          }
      ],
      associatedChat: {
            type: mongoose.Schema.ObjectId,
            ref: 'Chat',
            unique: true,
            sparse: true
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

groupSchema.index({ members: 1 });
groupSchema.index({ admins: 1 });
groupSchema.index({ tags: 1 });
groupSchema.index({ university: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
groupSchema.index({ 'joinRequests.user': 1 });


groupSchema.virtual('memberCount').get(function() {
    return this.members ? this.members.length : 0;
});
groupSchema.virtual('adminCount').get(function() {
    return this.admins ? this.admins.length : 0;
});
groupSchema.virtual('moderatorCount').get(function() {
    return this.moderators ? this.moderators.length : 0;
});

groupSchema.virtual('associatedPosts', {
    ref: 'Post',
    localField: '_id',
    foreignField: 'group',
    justOne: false
});

groupSchema.virtual('associatedReports', {
    ref: 'Report',
    localField: '_id',
    foreignField: 'targetId',
    match: { targetType: 'Group' },
    justOne: false
});


groupSchema.pre('save', function(next) {
    if (this.isNew) {
        this.admins.addToSet(this.createdBy);
        this.members.addToSet(this.createdBy);
        console.log(`Creator ${this.createdBy} added as admin and member to new group ${this.name}`);
    }
    next();
});

groupSchema.pre('validate', async function(next) {
    if (this.admins && this.admins.length > 0) {
        this.admins.forEach(adminId => this.members.addToSet(adminId));
        if (this.admins.length > 5) {
            next(new Error('A group cannot have more than 5 admins.'));
            return;
        }
    }

    if (this.moderators && this.moderators.length > 0) {
        this.moderators.forEach(modId => this.members.addToSet(modId));
        if (this.moderators.length > 10) {
            next(new Error('A group cannot have more than 10 moderators.'));
            return;
        }
    }

    next();
});


groupSchema.pre('findOneAndDelete', { document: false, query: true }, async function(next) {
    console.log('Group pre-findOneAndDelete triggered');
    const query = this.getQuery();
    const groupId = query._id;

    if (!groupId) {
        console.warn('Group ID not found in query for findOneAndDelete hook. Skipping cleanup.');
        return next();
    }

    try {
        const groupToDelete = await mongoose.model('Group').findById(groupId).select('profilePic coverPhoto');

        console.log(`Initiating cleanup for group ${groupId}`);
        const Post = mongoose.models.Post || mongoose.model('Post');
        const Report = mongoose.models.Report || mongoose.model('Report');
        const Chat = mongoose.models.Chat || mongoose.model('Chat');

        const cleanupPromises = [];

        console.log(`Queueing unlinking of posts for group ${groupId}`);
        cleanupPromises.push(
            Post.updateMany({ group: groupId }, { $set: { group: null } })
                .then(result => console.log(`Unlinked ${result.modifiedCount} posts.`))
        );

        console.log(`Queueing deletion of reports targeting group ${groupId}`);
        cleanupPromises.push(Report.deleteMany({ targetType: 'Group', targetId: groupId }));

        if (groupToDelete) {
            if (groupToDelete.profilePic && groupToDelete.profilePic.publicId) {
                console.log(`Queueing deletion of group profile pic ${groupToDelete.profilePic.publicId}`);
                cleanupPromises.push(cloudinary.uploader.destroy(groupToDelete.profilePic.publicId, { resource_type: 'image' }));
            }
            if (groupToDelete.coverPhoto && groupToDelete.coverPhoto.publicId) {
                console.log(`Queueing deletion of group cover photo ${groupToDelete.coverPhoto.publicId}`);
                cleanupPromises.push(cloudinary.uploader.destroy(groupToDelete.coverPhoto.publicId, { resource_type: 'image' }));
            }
            if (groupToDelete.associatedChat && Chat) {
                console.log(`Queueing deletion of associated chat ${groupToDelete.associatedChat} for group ${groupId}`);
                cleanupPromises.push(Chat.findByIdAndDelete(groupToDelete.associatedChat));
            }
        }


        await Promise.all(cleanupPromises);
        console.log(`Cleanup tasks completed for group ${groupId}`);
        next();
    } catch (error) {
        console.error(`Error during pre-delete cleanup for group ${groupId}:`, error);
        next(error);
    }
});


const Group = mongoose.model('Group', groupSchema);

module.exports = Group;
