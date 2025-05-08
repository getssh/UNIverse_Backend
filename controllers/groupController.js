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

exports.getGroups = async (req, res, next) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const userUniversity = req.user.university;

    const filter = {};
    if (req.query.type) filter.groupType = req.query.type;
    if (req.query.privacy) filter.privacy = req.query.privacy;
    if (req.query.universityId) filter.university = req.query.universityId;
    if (req.query.tag) filter.tags = { $in: [req.query.tag.toLowerCase()] };
    if (req.query.search) filter.name = { $regex: req.query.search, $options: 'i' };

    const accessibilityFilter = {
        $or: [
            { privacy: 'public' },
            ...(userUniversity ? [{ privacy: 'university_only', university: userUniversity }] : []),
            ...(userRole === 'teacher' ? [{ privacy: 'faculty_only', ...(userUniversity && { university: userUniversity }) }] : []),
            ...(userRole === 'student' ? [{ privacy: 'students_only', ...(userUniversity && { university: userUniversity }) }] : []),
            { members: userId }
        ]
    };
    const finalFilter = { ...filter, ...accessibilityFilter };

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort === 'members' ? { memberCountVirtual: -1 } :
                 req.query.sort === 'name' ? { name: 1 } : { createdAt: -1 };

    let groups;
    if (req.query.sort === 'members') {
        groups = await Group.aggregate([
            { $match: finalFilter },
            { $addFields: { memberCountActual: { $size: "$members" } } },
            { $sort: { memberCountActual: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]);

        await Group.populate(groups, [
            { path: 'createdBy', select: 'name profilePicUrl' },
            { path: 'admins', select: 'name profilePicUrl' },
            { path: 'university', select: 'name' }
        ]);
    } else {
        groups = await Group.find(finalFilter)
            .populate('createdBy', 'name profilePicUrl')
            .populate('admins', 'name profilePicUrl')
            .populate('university', 'name')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();
    }


    const totalGroups = await Group.countDocuments(finalFilter);
    const totalPages = Math.ceil(totalGroups / limit);

    res.status(200).json({
        success: true,
        count: groups.length,
        pagination: { totalGroups, totalPages, currentPage: page, limit },
        data: groups
    });
};