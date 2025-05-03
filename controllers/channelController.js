const Channel = require('../models/Channel');
const University = require('../models/University');
const Post = require('../models/Post');
// const Report = require('../models/Report');
const User = require('../models/User');
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const { getResourceTypeFromMime } = require('../utils/fileUtils');
const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose');


exports.createChannel = async (req, res, next) => {
    const { name, description, university, channelType, isPublic } = req.body;
    const profilePicFile = req.files?.profilePic?.[0];
    const adminUserId = req.user.id;

    if (!name || !university || !channelType) {
        return res.status(400).json({ success: false, error: 'Please provide name, university ID, and channel type.' });
    }

    //Do we need the below commented out validation? I think it got handeled with the model 
    // const allowedTypes = Channel.schema.path('channelType').enumValues;
    // if (!allowedTypes.includes(channelType)) {
    //     return res.status(400).json({ success: false, error: `Invalid channel type. Allowed types: ${allowedTypes.join(', ')}` });
    // }

    const universityExists = await University.findById(university);
    if (!universityExists) {
        return res.status(404).json({ success: false, error: `University not found with ID: ${university}` });
    }

    const existingChannel = await Channel.findOne({ name: name.trim(), university: university });
    if (existingChannel) {
        return res.status(409).json({ success: false, error: `A channel with the name "${name}" already exists in this university.` });
    }

    let profilePicData = {};
    if (profilePicFile) {
        try {
            console.log("Uploading Channel Profile Picture...");
            const resourceType = getResourceTypeFromMime(profilePicFile.mimetype);
            if (resourceType !== 'image') {
                 return res.status(400).json({ success: false, error: 'Channel profile picture must be an image file.' });
            }
            const result = await uploadToCloudinary(
                profilePicFile.buffer,
                profilePicFile.originalname,
                'channel_profile_pics',
                'image'
            );
            profilePicData = { url: result.secure_url, publicId: result.public_id };
            console.log("Channel Profile Picture Uploaded:", profilePicData.url);
        } catch (uploadError) {
            console.error("Channel profile pic upload failed:", uploadError);
            return res.status(500).json({ success: false, error: `Failed to upload profile picture: ${uploadError.message}` });
        }
    }

    const channelData = {
        name: name.trim(),
        description: description?.trim(),
        profilePic: profilePicData.url ? profilePicData : undefined,
        university: university,
        channelType: channelType,
        admin: adminUserId,
        members: [adminUserId],
        isPublic: isPublic !== undefined ? isPublic : true
    };

    let newChannel = await Channel.create(channelData);
    console.log(`Channel '${newChannel.name}' created successfully by admin ${adminUserId}`);

    newChannel = await Channel.findById(newChannel._id)
                              .populate('admin', 'name profilePicUrl')
                              .populate('university', 'name');

    res.status(201).json({
        success: true,
        data: newChannel
    });
};

exports.getChannels = async (req, res, next) => {
    const userId = req.user.id;
    const userUniversityId = req.user.university;

    const filter = {};

    let targetUniversityId = req.query.universityId
    if (targetUniversityId) {
        if (!mongoose.Types.ObjectId.isValid(targetUniversityId)) {
            return res.status(400).json({ success: false, error: 'Invalid University ID format.' });
        }
        filter.university = targetUniversityId;
    }

    if (req.query.channelType) {
        const allowedTypes = Channel.schema.path('channelType').enumValues;
        if (!allowedTypes.includes(req.query.channelType)) {
             return res.status(400).json({ success: false, error: `Invalid channel type filter. Allowed: ${allowedTypes.join(', ')}` });
        }
        filter.channelType = req.query.channelType;
    }

    if (req.query.member === 'true') {
        filter.members = userId;
    } else if (req.query.member === 'false'){
         filter.members = { $ne: userId };
    }

    if (req.query.member !== 'true') {
         filter.$or = [
             { isPublic: true },
             { members: userId }
         ];
    }

    let sort = { createdAt: -1 };
    if (req.query.rank === 'members') {
      //Todo add Proper ranking with aggregation (for now used name as a placeholder)
        console.warn("Ranking by member count requested");
        sort = { name: 1 };
    } else if (req.query.sort === 'name') {
         sort = { name: 1 };
    } else if (req.query.sort === 'oldest') {
        sort = { createdAt: 1 };
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const channels = await Channel.find(filter)
        .populate('admin', 'name profilePicUrl')
        .populate('university', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

    channels.forEach(channel => {
         channel.memberCount = channel.members ? channel.members.length : 0;
    });

    const totalChannels = await Channel.countDocuments(filter);
    const totalPages = Math.ceil(totalChannels / limit);

    res.status(200).json({
        success: true,
        count: channels.length,
        pagination: { totalChannels, totalPages, currentPage: page, limit },
        data: channels
    });
};

