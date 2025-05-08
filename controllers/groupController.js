const Group = require('../models/Group');
const User = require('../models/User');
const University = require('../models/University');
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const { getResourceTypeFromMime } = require('../utils/fileUtils');
const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose');

const isGroupAdmin = (group, userId) => {
  return group.admins.some(adminId => adminId.equals(userId));
};

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


exports.getGroupById = async (req, res, next) => {
    const { groupId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const userUniversity = req.user.university;

    const group = await Group.findById(groupId)
        .populate('createdBy', 'name profilePicUrl email')
        .populate('admins', 'name profilePicUrl email')
        .populate('moderators', 'name profilePicUrl email')
        .populate('university', 'name location')
        .lean();

    if (!group) {
        return res.status(404).json({ success: false, error: `Group not found.` });
    }

    const isMember = group.members.some(memberId => memberId.equals(userId));
    let canView = isMember || group.privacy === 'public';

    if (!canView && userUniversity) {
        if (group.privacy === 'university_only' && group.university?._id.equals(userUniversity)) canView = true;
        if (group.privacy === 'faculty_only' && userRole === 'teacher' && group.university?._id.equals(userUniversity)) canView = true;
        if (group.privacy === 'students_only' && userRole === 'student' && group.university?._id.equals(userUniversity)) canView = true;
    }

    if (!canView) {
        return res.status(403).json({ success: false, error: 'You are not authorized to view this group.' });
    }

    group.memberCount = group.members.length;
    group.adminCount = group.admins.length;
    group.moderatorCount = group.moderators.length;

    group.isCurrentUserMember = isMember;
    group.isCurrentUserAdmin = group.admins.some(adminId => adminId.equals(userId));
    group.isCurrentUserModerator = group.moderators.some(modId => modId.equals(userId));


    res.status(200).json({ success: true, data: group });
};

exports.updateGroup = async (req, res, next) => {
    const { groupId } = req.params;
    const userId = req.user.id;
    const { name, description, groupType, privacy, university, rules, tags } = req.body;
    const profilePicFile = req.files?.profilePic?.[0];
    const coverPhotoFile = req.files?.coverPhoto?.[0];

    let group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ success: false, error: 'Group not found.' });

    if (!isGroupAdmin(group, userId) && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Not authorized to update this group.' });
    }

    const imageUpdates = {};
    let oldProfilePicId = group.profilePic?.publicId;
    let oldCoverPhotoId = group.coverPhoto?.publicId;

    if (profilePicFile) {
        const result = await uploadToCloudinary(profilePicFile.buffer, profilePicFile.originalname, 'group_profile_pics', 'image');
        imageUpdates.profilePic = { url: result.secure_url, publicId: result.public_id };
    }
    if (coverPhotoFile) {
        const result = await uploadToCloudinary(coverPhotoFile.buffer, coverPhotoFile.originalname, 'group_cover_photos', 'image');
        imageUpdates.coverPhoto = { url: result.secure_url, publicId: result.public_id };
    }

    const updateData = { ...imageUpdates };
    if (name !== undefined) { updateData.name = name.trim(); }
    if (description !== undefined) updateData.description = description.trim();
    if (groupType !== undefined) updateData.groupType = groupType;
    if (privacy !== undefined) updateData.privacy = privacy;
    if (university !== undefined) updateData.university = university;
    if (rules !== undefined) updateData.rules = rules;
    if (tags !== undefined) updateData.tags = tags;

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, error: 'No update data provided.' });
    }

    group = await Group.findByIdAndUpdate(groupId, { $set: updateData }, { new: true, runValidators: true })
        .populate('createdBy admins moderators university', 'name profilePicUrl');

    if (imageUpdates.profilePic && oldProfilePicId) cloudinary.uploader.destroy(oldProfilePicId).catch(console.error);
    if (imageUpdates.coverPhoto && oldCoverPhotoId) cloudinary.uploader.destroy(oldCoverPhotoId).catch(console.error);

    res.status(200).json({ success: true, data: group });
};


exports.deleteGroup = async (req, res, next) => {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ success: false, error: 'Group not found.' });

    if (!isGroupAdmin(group, userId) && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this group.' });
    }

    await Group.findByIdAndDelete(groupId);

    res.status(200).json({ success: true, message: 'Group deleted successfully.' });
};


exports.joinOrRequestToJoinGroup = async (req, res, next) => {
  const { groupId } = req.params;
  const userId = req.user.id;
  const user = await User.findById(userId).select('role university');
  const { message } = req.body;

  const group = await Group.findById(groupId);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found.' });
  if (group.status !== 'active') return res.status(400).json({ success: false, error: 'This group is not currently active.' });

  if (group.members.some(memberId => memberId.equals(userId))) {
      return res.status(400).json({ success: false, error: 'You are already a member of this group.' });
  }

  let canJoinDirectly = false;
  if (group.privacy === 'public') canJoinDirectly = true;
  if (user.university && group.university && user.university.equals(group.university)) {
      if (group.privacy === 'university_only') canJoinDirectly = true;
      if (group.privacy === 'faculty_only' && user.role === 'teacher') canJoinDirectly = true;
      if (group.privacy === 'students_only' && user.role === 'student') canJoinDirectly = true;
  }

  if (canJoinDirectly) {
      group.members.addToSet(userId);
      group.joinRequests = group.joinRequests.filter(req => !req.user.equals(userId));
      await group.save();
      return res.status(200).json({ success: true, message: 'Successfully joined the group.' });
  }

  if (group.privacy === 'private') {
      if (group.joinRequests.some(req => req.user.equals(userId))) {
          return res.status(400).json({ success: false, error: 'You have already requested to join this group.' });
      }
      group.joinRequests.push({ user: userId, message: message?.trim() });
      await group.save();
      return res.status(200).json({ success: true, message: 'Your request to join the group has been sent.' });
  }

  return res.status(403).json({ success: false, error: 'You do not meet the criteria to join this group.' });
};

exports.leaveGroup = async (req, res, next) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  const group = await Group.findById(groupId);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found.' });

  if (!group.members.some(memberId => memberId.equals(userId))) {
      return res.status(400).json({ success: false, error: 'You are not a member of this group.' });
  }

  if (isGroupAdmin(group, userId) && group.admins.length === 1 && group.members.length > 1) {
       return res.status(400).json({ success: false, error: 'You are the last admin. Promote another member to admin before leaving.' });
  }

  group.members.pull(userId);
  group.admins.pull(userId);
  group.moderators.pull(userId);

  await group.save();

  res.status(200).json({ success: true, message: 'Successfully left the group.' });
};