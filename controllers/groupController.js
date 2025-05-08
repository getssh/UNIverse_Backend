const Group = require('../models/Group');
const User = require('../models/User');
const University = require('../models/University');
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const { getResourceTypeFromMime } = require('../utils/fileUtils');
const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose');


exports.createGroup = async (req, res, next) => {
    const { name, description, groupType, privacy, university, rules, tags } = req.body;
    const profilePicFile = req.files?.profilePic?.[0];
    const coverPhotoFile = req.files?.coverPhoto?.[0];
    const createdBy = req.user.id;

    if (!name || !groupType || !privacy) {
        return res.status(400).json({ success: false, error: 'Name, group type, and privacy are required.' });
    }
    if (university && !mongoose.Types.ObjectId.isValid(university)) {
         return res.status(400).json({ success: false, error: 'Invalid University ID format.' });
    }
    if (university) {
        const uniExists = await University.findById(university);
        if (!uniExists) return res.status(404).json({ success: false, error: 'University not found.' });
    }

    const existingGroup = await Group.findOne({ name: name.trim() });
    if (existingGroup) {
        return res.status(409).json({ success: false, error: `Group name "${name}" already exists.` });
    }

    let profilePicData = {}, coverPhotoData = {};
    const uploadPromises = [];

    if (profilePicFile) {
        uploadPromises.push(
            uploadToCloudinary(profilePicFile.buffer, profilePicFile.originalname, 'group_profile_pics', 'image')
                .then(result => profilePicData = { url: result.secure_url, publicId: result.public_id })
                .catch(err => { throw new Error(`Profile pic upload failed: ${err.message}`) })
        );
    }
    if (coverPhotoFile) {
        uploadPromises.push(
            uploadToCloudinary(coverPhotoFile.buffer, coverPhotoFile.originalname, 'group_cover_photos', 'image')
                .then(result => coverPhotoData = { url: result.secure_url, publicId: result.public_id })
                .catch(err => { throw new Error(`Cover photo upload failed: ${err.message}`) })
        );
    }
    await Promise.all(uploadPromises);

    const groupData = {
        name: name.trim(),
        description: description?.trim(),
        profilePic: profilePicData.url ? profilePicData : undefined,
        coverPhoto: coverPhotoData.url ? coverPhotoData : undefined,
        createdBy,
        groupType,
        privacy,
        university: university || undefined,
        rules: rules || [],
        tags: tags || [],
    };

    let newGroup = await Group.create(groupData);
    newGroup = await Group.findById(newGroup._id)
                         .populate('createdBy', 'name profilePicUrl')
                         .populate('admins', 'name profilePicUrl')
                         .populate('university', 'name')
                         .lean();

    res.status(201).json({ success: true, data: newGroup });
};
