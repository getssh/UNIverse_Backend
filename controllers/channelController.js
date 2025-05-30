const Channel = require('../models/Channel');
const University = require('../models/University');
const Post = require('../models/Post');
const Report = require('../models/Report');
const User = require('../models/User');
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const { getResourceTypeFromMime } = require('../utils/fileUtils');
const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose');


/**
 * @route   POST api/channels
 * @desc    Create a new channel
 * @access  Private
 */
exports.createChannel = async (req, res, next) => {
    const { name, description, university, channelType, isPublic } = req.body;
    const profilePicFile = req.file;
    const adminUserId = req.user.id;

    const universityAdmin = await User.findById(adminUserId);

    if (!universityAdmin || !universityAdmin.university.equals(university)) {
      return res.status(404).json({success: false, error: `University not found or admin not associated with a university`})
    }

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
            let members = [adminUserId]; // Start with the admin
            try {
                const universityUsers = await User.find({ university: university }).select('_id');
                const userIds = universityUsers.map(user => user._id.toString());

                members = [...new Set([adminUserId, ...userIds])]; // Ensure no duplicates
            } catch (err) {
                return res.status(500).json({ success: false, error: "Failed to fetch university users." });
            }

    const channelData = {
        name: name.trim(),
        description: description?.trim(),
        profilePic: profilePicData.url ? profilePicData : undefined,
        university: university,
        channelType: channelType,
        members,
        members: [adminUserId],
        admin: adminUserId,
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

/**
 * @route   GET api/channels
 * @desc    Get all channels
 * @access  Private
 */
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
        hasMore: page < totalPages,
        pagination: { totalChannels, totalPages, currentPage: page, limit },
        data: channels
    });
};


/**
 * @route   GET api/channels/:channelId
 * @desc    Get a channel by ID
 * @access  Private
 */
exports.getChannelById = async (req, res, next) => {
    const { channelId } = req.params;
    const userId = req.user.id;
    const userUniversityId = req.user.university?.toString(); 

    const channel = await Channel.findById(channelId)
        .populate('admin', 'name profilePicUrl email')
        .populate('university', 'name location')
        .lean();

    if (!channel) {
        return res.status(404).json({ success: false, error: `Channel not found with ID: ${channelId}` });
    }

    const isMember = channel.members.some(memberId => memberId.equals(userId));
    const isCorrectUniversity = channel.university._id.toString() === userUniversityId;

    if (!channel.isPublic && !isMember) {
         return res.status(403).json({ success: false, error: 'You are not authorized to view this private channel.' });
    }

     channel.memberCount = channel.members ? channel.members.length : 0;

    res.status(200).json({
        success: true,
        data: channel
    });
};

// sending all channels a given user is a member of
/**
 * @route   GET api/channels/user/:userId
 * @desc    Get channels by user ID
 * @access  Private
 */
exports.getUserChannels = async (req, res, next) => {
    const userId = req.user.id;
    const userUniversityId = req.user.university?.toString();
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const filter = {
        members: userId,
        $or: [
            { isPublic: true },
            { university: userUniversityId }
        ]
    };
    const channels = await Channel.find(filter)
        .populate('admin', 'name profilePicUrl email')
        .populate('university', 'name location')
        .sort({ createdAt: -1 })
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
        hasMore: page < totalPages,
        pagination: { totalChannels, totalPages, currentPage: page, limit },
        data: channels
    });
};

//sending all channels a given user is not a member of
/**
 * @route   GET api/channels/non-member/:userId
 * @desc    Get non-member channels by user ID
 * @access  Private
 */
exports.getNonMemberChannels = async (req, res, next) => {
    const userId = req.user.id;
    const userUniversityId = req.user.university?.toString();
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;  
    const skip = (page - 1) * limit;

    const orCondition = userUniversityId
  ? [{ isPublic: true }, { university: userUniversityId }]
  : [{ isPublic: true }];

    const filter = {
  members: { $nin: [userId] },
  $or: orCondition
};

      
    const channels = await Channel.find(filter)
        .populate('admin', 'name profilePicUrl email')
        .populate('university', 'name location')
        .sort({ createdAt: -1 })
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
        hasMore: page < totalPages,
        pagination: { totalChannels, totalPages, currentPage: page, limit },
        data: channels
    });
};

/**
 * @route   PUT api/channels/:channelId/update
 * @desc    Update a channel
 * @access  Private
 */
exports.updateChannel = async (req, res, next) => {
    const { channelId } = req.params;
    const { name, description, channelType, isPublic, admin } = req.body;
    const profilePicFile = req.file;
    const userId = req.user.id;

    let channel = await Channel.findById(channelId);
    if (!channel) {
        return res.status(404).json({ success: false, error: `Channel not found with ID: ${channelId}` });
    }

    let profilePicUpdate = {};
    let oldPublicId = channel.profilePic?.publicId;

    if (profilePicFile) {
        try {
            console.log("Uploading new Channel Profile Picture...");
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
            profilePicUpdate = { url: result.secure_url, publicId: result.public_id };
             console.log("New Channel Profile Picture Uploaded:", profilePicUpdate.url);
        } catch (uploadError) {
             console.error("Channel profile pic update failed:", uploadError);
             return res.status(500).json({ success: false, error: `Failed to upload profile picture: ${uploadError.message}` });
        }
    }

    const updates = {};
    if (name !== undefined) { updates.name = name.trim(); }
    if (description !== undefined) updates.description = description.trim();
    if (channelType !== undefined) {
         const allowedTypes = Channel.schema.path('channelType').enumValues;
         if (!allowedTypes.includes(channelType)) {
             return res.status(400).json({ success: false, error: `Invalid channel type. Allowed types: ${allowedTypes.join(', ')}` });
         }
         updates.channelType = channelType;
    }
    if (isPublic !== undefined) updates.isPublic = isPublic;

    const isNewAdminMember = channel.members.some(memberId => memberId.equals(admin));

    if (admin !== undefined && isNewAdminMember) {
         updates.admin = admin;
    }

    if (!isNewAdminMember) {
      return res.status(400).json({ success: false, message: 'Admin must be a member of the channel' });
    }

    if (profilePicUpdate.url) {
        updates.profilePic = profilePicUpdate;
    }

    if (Object.keys(updates).length === 0 && !profilePicFile) {
        return res.status(400).json({ success: false, error: 'No update data provided.' });
    }

    const updatedChannel = await Channel.findByIdAndUpdate(channelId, updates, {
        new: true,
        runValidators: true
    })
    .populate('admin', 'name profilePicUrl')
    .populate('university', 'name');

    if (!updatedChannel) {
         return res.status(404).json({ success: false, error: `Channel not found during update.` });
    }

     if (profilePicUpdate.url && oldPublicId && oldPublicId !== profilePicUpdate.publicId) {
         console.log(`Deleting old channel profile pic: ${oldPublicId}`);
         cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image' })
             .catch(err => console.error(`Failed to delete old Cloudinary file ${oldPublicId}:`, err));
     }

    console.log(`Channel ${channelId} updated successfully by user ${userId}`);
    res.status(200).json({
        success: true,
        data: updatedChannel
    });
};

/**
 * @route   DELETE api/channels/:channelId/delete
 * @desc    Delete a channel
 * @access  Private
 */
exports.deleteChannel = async (req, res, next) => {
    const { channelId } = req.params;
    const userId = req.user.id;
    
    //Todo maybe handle the auth middleware here to check if the user is channel admin? fight now the middleware check for admin role
     const channel = await Channel.findById(channelId);
     if (!channel) {
         return res.status(404).json({ success: false, error: `Channel not found with ID: ${channelId}` });
     }

    await Channel.findByIdAndDelete(channelId);

    console.log(`Channel ${channelId} deleted successfully by user ${userId}`);
    res.status(200).json({ success: true, message: 'Channel deleted successfully.' });
};

/**
 * @route   POST api/channels/:channelId/join
 * @desc    Join a channel
 * @access  Private
 */
exports.joinChannel = async (req, res, next) => {
    const { channelId } = req.params;
    const userId = req.user.id;
    const userUniversityId = req.user.university?.toString();

    const channel = await Channel.findById(channelId);
    if (!channel) {
        return res.status(404).json({ success: false, error: `Channel not found with ID: ${channelId}` });
    }

     if (!channel.isPublic && userUniversityId !== channel.university.toString()) {
        return res.status(403).json({ success: false, error: 'Cannot join private channels outside your university.' });
     }

    const updatedChannel = await Channel.findByIdAndUpdate(
        channelId,
        { $addToSet: { members: userId } },
        { new: true }
    ).lean();

    if (!updatedChannel) {
        return res.status(404).json({ success: false, error: `Channel not found during join attempt.` });
    }


    console.log(`User ${userId} joined channel ${channelId}`);
    res.status(200).json({ success: true, message: 'Successfully joined channel.' });
};

/**
 * @route   POST api/channels/:channelId/leave
 * @desc    Leave a channel
 * @access  Private
 */
exports.leaveChannel = async (req, res, next) => {
    const { channelId } = req.params;
    const userId = req.user.id;

     const channel = await Channel.findById(channelId);
     if (!channel) {
         return res.status(404).json({ success: false, error: `Channel not found with ID: ${channelId}` });
     }

     if (channel.admin && channel.admin.equals(userId)) {
         return res.status(400).json({ success: false, error: 'Channel admin cannot leave the channel directly. Transfer admin role first.' });
     }

    const updateResult = await Channel.findByIdAndUpdate(
        channelId,
        { $pull: { members: userId } },
        { new: true }
    );

     if (!updateResult) {
          return res.status(404).json({ success: false, error: `Channel not found during leave attempt.` });
     }

    console.log(`User ${userId} left channel ${channelId}`);
    res.status(200).json({ success: true, message: 'Successfully left channel.' });
};

/**
 * @route   GET api/channels/:channelId/members
 * @desc    Get channel members
 * @access  Private
 */
exports.getChannelMembers = async (req, res, next) => {
    const { channelId } = req.params;
    const userId = req.user.id;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

     const channel = await Channel.findById(channelId).select('members admin isPublic university').lean();
     if (!channel) {
         return res.status(404).json({ success: false, error: `Channel not found with ID: ${channelId}` });
     }

     const isMember = channel.members.some(memberId => memberId.equals(userId));
     const isAdmin = channel.admin && channel.admin.equals(userId);
     const isSystemAdmin = req.user.role === 'admin';

     if (!isAdmin && !isMember && !channel.isPublic && !isSystemAdmin) {
        return res.status(403).json({ success: false, error: 'Not authorized to view members of this channel.' });
     }

     const memberIds = channel.members;

     const members = await User.find({ '_id': { $in: memberIds } })
         .select('name profilePicUrl email')
         .sort({ name: 1 })
         .skip(skip)
         .limit(limit)
         .lean();

     const totalMembers = memberIds.length;
     const totalPages = Math.ceil(totalMembers / limit);

     res.status(200).json({
         success: true,
         count: members.length,
         pagination: { totalMembers, totalPages, currentPage: page, limit },
         data: members
     });
};

// sending channels with search query
/**
 * @route   GET api/channels/search/:query
 * @desc    Search channels
 * @access  Private
 */
exports.searchChannels = async (req, res, next) => {
  try {
    const { query } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Validate query exists and is a string
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Search query must be a non-empty string' 
      });
    }

    // Create base search query
    const searchQuery = {
      $and: [
        {
          $or: [
            { name: { $regex: query.trim(), $options: 'i' } },
            { description: { $regex: query.trim(), $options: 'i' } }
          ]
        }
      ]
    };

    

    // Handle membership filters
    if (req.query.member === 'true') {
      searchQuery.$and.push({ members: userId });
    } else if (req.query.member === 'false') {
      searchQuery.$and.push({ members: { $ne: userId } });
    } else {
      // Default: show public channels or channels user is member of
      searchQuery.$and.push({
        $or: [
          { isPublic: true },
          { members: userId }
        ]
      });
    }

    const [channels, totalChannels] = await Promise.all([
      Channel.find(searchQuery)
        .populate('admin', 'name profilePicUrl email')
        .populate('university', 'name location')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .then(channels => {
          return channels.map(channel => ({
            ...channel,
            memberCount: channel.members?.length || 0
          }));
        }),
      Channel.countDocuments(searchQuery)
    ]);

    const totalPages = Math.ceil(totalChannels / limit);

    res.status(200).json({
      success: true,
      count: channels.length,
      hasMore: page < totalPages,
      pagination: { totalChannels, totalPages, currentPage: page, limit },
      data: channels
    });

  } catch (error) {
    console.error("Error searching channels:", error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error',
      message: error.message 
    });
  }
};
