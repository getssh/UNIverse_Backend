const mongoose = require('mongoose');
const User = require('./User');
const Post = require('./Post');
const Report = require('./Report');
// const Chat = require('./Chat'); // to be done tommorow?
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
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);


const Group = mongoose.model('Group', groupSchema);

module.exports = Group;
