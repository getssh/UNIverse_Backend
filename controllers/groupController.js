const Group = require('../models/Group');
const User = require('../models/User');
const University = require('../models/University');
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const { getResourceTypeFromMime } = require('../utils/fileUtils');
const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const { getIO } = require('../socket');

const isGroupAdmin = (group, userId) => {
  return group.admins.some(adminId => adminId.equals(userId));
};
const isGroupStaff = (group, userId) => {
  const userIdStr = userId.toString();
  const isAdmin = group.admins.some(adminId => adminId.toString() === userIdStr);
  const isModerator = group.moderators.some(modId => modId.toString() === userIdStr);
  return isAdmin || isModerator;
};

exports.createGroup = async (req, res, next) => {
    const { name, description, groupType, privacy, university, rules, tags } = req.body;
    const profilePicFile = req.files?.profilePic?.[0];
    const coverPhotoFile = req.files?.coverPhoto?.[0];
    const createdBy = req.user.id;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!name || !groupType || !privacy) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, error: 'Name, group type, and privacy are required.' });
      }
      if (university && !mongoose.Types.ObjectId.isValid(university)) {
           return res.status(400).json({ success: false, error: 'Invalid University ID format.' });
      }
      if (university) {
          const uniExists = await University.findById(university).session(session);
          if (!uniExists) {
              await session.abortTransaction(); session.endSession();
              return res.status(404).json({ success: false, error: 'University not found.' });
          }
      }
  
      const existingGroup = await Group.findOne({ name: name.trim() }).session(session);
      if (existingGroup) {
          await session.abortTransaction(); session.endSession();
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
  
      const newGroupArray = await Group.create([groupData], { session });
      let newGroup = newGroupArray[0];
  
      const chatData = {
        name: newGroup.name,
        chatType: 'group',
        participants: [...newGroup.members],
        group: newGroup._id,
      };
      const newChatArray = await Chat.create([chatData], { session });
      const newChat = newChatArray[0];
  
      newGroup.associatedChat = newChat._id;
      await newGroup.save({ session });
  
      await session.commitTransaction();
      session.endSession();
  
      console.log(`Group '${newGroup.name}' and associated chat ${newChat._id} created.`);
  
      newGroup = await Group.findById(newGroup._id)
                        .populate('createdBy', 'name profilePicUrl')
                        .populate('admins', 'name profilePicUrl')
                        .populate('university', 'name')
                        .populate('associatedChat', '_id name chatType')
                        .lean();
  
      res.status(201).json({ success: true, data: newGroup });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Error creating group or chat:", error);
        if (profilePicData.publicId) cloudinary.uploader.destroy(profilePicData.publicId).catch(console.error);
        if (coverPhotoData.publicId) cloudinary.uploader.destroy(coverPhotoData.publicId).catch(console.error);
        next(error);
    }
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
    group.isCurrentUserAdmin = group.admins.some(adminId => adminId._id.equals(userId));
    group.isCurrentUserModerator = group.moderators.some(modId => modId._id.equals(userId));


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

  const group = await Group.findById(groupId).populate('associatedChat', '_id');
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

      if (group.associatedChat && group.associatedChat._id) {
        const updatedChat = await Chat.findByIdAndUpdate(group.associatedChat._id,
            { $addToSet: { participants: userId } },
            { new: true }
        ).populate('participants', 'name profilePicUrl');
        try {
            getIO().to(group.associatedChat._id.toString()).emit('chatParticipantsUpdated', {
                chatId: group.associatedChat._id,
                participants: updatedChat.participants
            });
        } catch (e) { console.error("Socket emit error:", e.message); }

        console.log(`User ${userId} added to chat participants for group ${groupId}`);
      }

      return res.status(200).json({ success: true, message: 'Successfully joined the group.' });
  }

  if (group.privacy === 'private') {
      if (group.joinRequests.some(reqFind => reqFind.user.equals(userId))) {
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

  const group = await Group.findById(groupId).populate('associatedChat', '_id');
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

  if (group.members.length === 0) { group.status = 'archived'; }

  await group.save();

  if (group.associatedChat && group.associatedChat._id) {
    const updatedChat = await Chat.findByIdAndUpdate(group.associatedChat._id,
        { $pull: { participants: userId } },
        { new: true }
    ).populate('participants', 'name profilePicUrl');
    if (updatedChat) {
        try {
            getIO().to(group.associatedChat._id.toString()).emit('chatParticipantsUpdated', {
                chatId: group.associatedChat._id,
                participants: updatedChat.participants
            });
        } catch (e) { console.error("Socket emit error:", e.message); }
      
    }
    console.log(`User ${userId} removed from chat participants for group ${groupId}`);
  }

  res.status(200).json({ success: true, message: 'Successfully left the group.' });
};

exports.getJoinRequests = async (req, res, next) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  const group = await Group.findById(groupId).select('admins moderators joinRequests')
                            .populate('joinRequests.user', 'name email profilePicUrl');

  if (!group) return res.status(404).json({ success: false, error: 'Group not found.' });

  if (!isGroupStaff(group, userId) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to view join requests.' });
  }

  res.status(200).json({ success: true, data: group.joinRequests });
};

exports.manageJoinRequest = async (req, res, next) => {
  const { groupId, requestId } = req.params;
  const { action } = req.body;
  const adminUserId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ success: false, error: "Invalid request user ID." });
  }

  const group = await Group.findById(groupId).populate('associatedChat', '_id');
  if (!group) return res.status(404).json({ success: false, error: 'Group not found.' });

  if (!isGroupStaff(group, adminUserId) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to manage join requests.' });
  }

  const requestIndex = group.joinRequests.findIndex(reqFind => reqFind.user.equals(requestId));
  if (requestIndex === -1) {
      return res.status(404).json({ success: false, error: 'Join request not found.' });
  }

  if (action == 'approve') {
      group.members.addToSet(requestId);
      group.joinRequests.splice(requestIndex, 1);
      await group.save();

      if (group.associatedChat && group.associatedChat._id) {
        const updatedChat = await Chat.findByIdAndUpdate(group.associatedChat._id,
            { $addToSet: { participants: requestId } },
            { new: true }
        ).populate('participants', 'name profilePicUrl');
        try {
            getIO().to(group.associatedChat._id.toString()).emit('chatParticipantsUpdated', {
                chatId: group.associatedChat._id,
                participants: updatedChat.participants
            });
        } catch (e) { console.error("Socket emit error:", e.message); }

        console.log(`User ${requestId} (approved) added to chat for group ${groupId}`);
      }

      return res.status(200).json({ success: true, message: 'Join request approved.' });
  } else {
      group.joinRequests.splice(requestIndex, 1);
      await group.save();

      return res.status(200).json({ success: true, message: 'Join request rejected.' });
  }
};

exports.promoteToAdmin = async (req, res, next) => {
  const { groupId, memberId } = req.params;
  const currentAdminId = req.user.id;

  const group = await Group.findById(groupId);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found.' });

  if (!isGroupAdmin(group, currentAdminId)) {
      return res.status(403).json({ success: false, error: 'Only group admins can promote members.' });
  }
  if (!group.members.some(id => id.equals(memberId))) {
      return res.status(400).json({ success: false, error: 'User is not a member of this group.' });
  }
  if (group.admins.length >= 5) {
      return res.status(400).json({ success: false, error: 'Maximum number of admins (5) reached.' });
  }

  group.admins.addToSet(memberId);
  group.moderators.pull(memberId);
  await group.save();
  res.status(200).json({ success: true, message: 'Member promoted to admin.' });
};

exports.demoteAdmin = async (req, res, next) => {
  const { groupId, adminIdToRemove } = req.params;
  const currentAdminId = req.user.id;

  const group = await Group.findById(groupId);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found.' });

  if (!isGroupAdmin(group, currentAdminId)) {
      return res.status(403).json({ success: false, error: 'Only group admins can demote other admins.' });
  }
  if (!group.admins.some(id => id.equals(adminIdToRemove))) {
      return res.status(400).json({ success: false, error: 'User is not an admin of this group.' });
  }
  if (group.admins.length === 1 && adminIdToRemove.toString() === group.createdBy.toString()) {
      return res.status(400).json({ success: false, error: 'Cannot demote the last admin. Promote another admin first.' });
  }
   if (adminIdToRemove.toString() === currentAdminId && group.admins.length === 1) {
       return res.status(400).json({ success: false, error: 'You are the last admin and cannot demote yourself. Promote another admin first.' });
   }


  group.admins.pull(adminIdToRemove);
  await group.save();
  res.status(200).json({ success: true, message: 'Admin demoted successfully.' });
};

exports.promoteToModerator = async (req, res, next) => {
  const { groupId, memberId } = req.params;
  const currentAdminId = req.user.id;

  const group = await Group.findById(groupId);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found.' });

  if (!isGroupAdmin(group, currentAdminId)) {
      return res.status(403).json({ success: false, error: 'Only group admins can promote members to moderator.' });
  }

  if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ success: false, error: 'Invalid member ID format.' });
  }
  if (!group.members.some(id => id.equals(memberId))) {
      return res.status(400).json({ success: false, error: 'User is not a member of this group.' });
  }

  if (group.admins.some(id => id.equals(memberId))) {
      return res.status(400).json({ success: false, error: 'User is already an admin of this group.' });
  }

  if (group.moderators.length >= 10) {
      return res.status(400).json({ success: false, error: 'Maximum number of moderators (10) reached.' });
  }

  group.moderators.addToSet(memberId);
  await group.save();

  console.log(`Member ${memberId} promoted to moderator in group ${groupId} by admin ${currentAdminId}`);
  res.status(200).json({ success: true, message: 'Member promoted to moderator.' });
};


exports.demoteModerator = async (req, res, next) => {
  const { groupId, moderatorIdToRemove } = req.params;
  const currentAdminId = req.user.id;

  const group = await Group.findById(groupId);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found.' });

  if (!isGroupAdmin(group, currentAdminId)) {
      return res.status(403).json({ success: false, error: 'Only group admins can demote moderators.' });
  }

  if (!mongoose.Types.ObjectId.isValid(moderatorIdToRemove)) {
      return res.status(400).json({ success: false, error: 'Invalid moderator ID format.' });
  }
  if (!group.moderators.some(id => id.equals(moderatorIdToRemove))) {
      return res.status(400).json({ success: false, error: 'User is not a moderator of this group.' });
  }

  group.moderators.pull(moderatorIdToRemove);
  await group.save();

  console.log(`Moderator ${moderatorIdToRemove} demoted in group ${groupId} by admin ${currentAdminId}`);
  res.status(200).json({ success: true, message: 'Moderator demoted successfully.' });
};

exports.kickMember = async (req, res, next) => {
  const { groupId, memberIdToKick } = req.params;
  const currentStaffId = req.user.id;

  const group = await Group.findById(groupId).populate('associatedChat', '_id');
  if (!group) return res.status(404).json({ success: false, error: 'Group not found.' });

  if (!isGroupStaff(group, currentStaffId)) {
      return res.status(403).json({ success: false, error: 'Only group admins or moderators can kick members.' });
  }

  if (!group.members.some(id => id.equals(memberIdToKick))) {
      return res.status(400).json({ success: false, error: 'User is not a member of this group.' });
  }

  if (memberIdToKick.toString() === currentStaffId.toString()) {
      return res.status(400).json({ success: false, error: "You cannot kick yourself. Use the 'leave group' option." });
  }

  const targetIsAdmin = group.admins.some(id => id.equals(memberIdToKick));
  if (targetIsAdmin && !isGroupAdmin(group, currentStaffId)) {
      return res.status(403).json({ success: false, error: 'Moderators cannot kick group admins.' });
  }

  if (memberIdToKick.toString() === group.createdBy.toString()) {
      return res.status(403).json({ success: false, error: 'The group creator cannot be kicked.' });
  }

  group.members.pull(memberIdToKick);
  group.admins.pull(memberIdToKick);
  group.moderators.pull(memberIdToKick);
  await group.save();

  if (group.associatedChat && group.associatedChat._id) {
    const updatedChat = await Chat.findByIdAndUpdate(group.associatedChat._id,
        { $pull: { participants: memberIdToKick } },
        { new: true }
    ).populate('participants', 'name profilePicUrl');
    if (updatedChat) {
        try {
            getIO().to(group.associatedChat._id.toString()).emit('chatParticipantsUpdated', {
                chatId: group.associatedChat._id,
                participants: updatedChat.participants
            });
        } catch (e) { console.error("Socket emit error:", e.message); }
    }
    console.log(`Kicked user ${memberIdToKick} removed from chat for group ${groupId}`);
  }

  console.log(`Member ${memberIdToKick} kicked from group ${groupId} by staff ${currentStaffId}`);

  res.status(200).json({ success: true, message: 'Member kicked successfully.' });
};

// sending groups that the user is a member of with the given userId
exports.getUserGroups = async (req, res, next) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  try {
    const groups = await Group.find({ members: userId })
      .populate('createdBy', 'name profilePicUrl')
      .populate('admins', 'name profilePicUrl')
      .populate('university', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalGroups = await Group.countDocuments({ members: userId });
    const totalPages = Math.ceil(totalGroups / limit);

    res.status(200).json({
      success: true,
      count: groups.length,
      pagination: { totalGroups, totalPages, currentPage: page, limit },
      data: groups
    });
  } catch (error) {
    console.error("Error fetching user's groups:", error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

//sending groups that the user created with the given userId
exports.getUserCreatedGroups = async (req, res, next) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  try {
    const groups = await Group.find({ createdBy: userId })
      .populate('createdBy', 'name profilePicUrl')
      .populate('admins', 'name profilePicUrl')
      .populate('university', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalGroups = await Group.countDocuments({ createdBy: userId });
    const totalPages = Math.ceil(totalGroups / limit);

    res.status(200).json({
      success: true,
      count: groups.length,
      pagination: { totalGroups, totalPages, currentPage: page, limit },
      data: groups
    });
  } catch (error) {
    console.error("Error fetching user's created groups:", error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
// sending that the user is not a member of with the given userId
exports.getNonMemberGroups = async (req, res, next) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  try {
    const groups = await Group.find({ members: { $ne: userId } })
      .populate('createdBy', 'name profilePicUrl')
      .populate('admins', 'name profilePicUrl')
      .populate('university', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalGroups = await Group.countDocuments({ members: { $ne: userId } });
    const totalPages = Math.ceil(totalGroups / limit);

    res.status(200).json({
      success: true,
      count: groups.length,
      pagination: { totalGroups, totalPages, currentPage: page, limit },
      data: groups
    });
  } catch (error) {
    console.error("Error fetching non-member groups:", error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// allowing a user to join a group without sending a request
exports.joinGroupWithoutRequest = async (req, res, next) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  const group = await Group.findById(groupId).populate('associatedChat', '_id');
  if (!group) return res.status(404).json({ success: false, error: 'Group not found.' });
  if (group.members.some(memberId => memberId.equals(userId))) {
      return res.status(400).json({ success: false, error: 'You are already a member of this group.' });
  }
  if (group.privacy !== 'public') {
      return res.status(403).json({ success: false, error: 'This group is not public.' });
  }
  group.members.addToSet(userId);
  group.joinRequests = group.joinRequests.filter(req => !req.user.equals(userId));
  await group.save();
  if (group.associatedChat && group.associatedChat._id) {
    await Chat.findByIdAndUpdate(group.associatedChat._id, {
        $addToSet: { participants: userId }
    });
    console.log(`User ${userId} added to chat participants for group ${groupId}`);
  }
  res.status(200).json({ success: true, message: 'Successfully joined the group.' });
}

//sending groups with search query
exports.searchGroups = async (req, res, next) => {
  try {
    // Get query from URL params (since frontend uses /search/:query)
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

    const searchQuery = {
      name: { 
        $regex: query.trim(), // Ensure string and trim whitespace
        $options: 'i' // Case insensitive
      }
    };

    const [groups, totalGroups] = await Promise.all([
      Group.find(searchQuery)
        .populate('createdBy', 'name profilePicUrl')
        .populate('admins', 'name profilePicUrl')
        .populate('university', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Group.countDocuments(searchQuery)
    ]);

    const totalPages = Math.ceil(totalGroups / limit);

    res.status(200).json({
      success: true,
      count: groups.length,
      pagination: { totalGroups, totalPages, currentPage: page, limit },
      data: groups
    });

  } catch (error) {
    console.error("Error searching groups:", error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error',
      message: error.message 
    });
  }
};