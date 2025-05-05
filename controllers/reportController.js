const Report = require('../models/Report');
const Post = require('../models/Post');
// const Group = require('../models/Group'); //group coming soon 🙂
const User = require('../models/User');
const Comment = require('../models/Comment');
const Channel = require('../models/Channel');
const mongoose = require('mongoose');

const getModelForTargetType = (type) => {
    switch (type) {
        case 'Post': return Post;
        // case 'Group': return Group;
        case 'Comment': return Comment;
        case 'Channel': return Channel;
        case 'User': return User;
        default: return null;
    }
};

const handleReportThresholds = async (targetType, targetId) => {
    console.log(`Checking report thresholds for ${targetType} ID: ${targetId}`);
    try {
        const unresolvedReportCount = await Report.countDocuments({
            targetId: targetId,
            targetType: targetType,
            resolved: false
        });
        console.log(`Unresolved report count: ${unresolvedReportCount}`);

        const TargetModel = getModelForTargetType(targetType);
        if (!TargetModel) return; 

        if (targetType === 'Post' || targetType === 'Comment') {
            const item = await TargetModel.findById(targetId).select('createdBy reports');
            if (!item) return;

            const author = await User.findById(item.createdBy).select('accountStatus');
            if (!author) return;

            if (unresolvedReportCount >= 15) {
                if (author.accountStatus !== 'banned') {
                    author.accountStatus = 'banned';
                    await author.save();
                    console.log(`User ${author._id} BANNED due to ${unresolvedReportCount} reports on ${targetType} ${targetId}`);
                    // TODO: Implement further ban actions (logout, etc.) if needed 
                }

                await TargetModel.findByIdAndDelete(targetId);
                console.log(`${targetType} ${targetId} DELETED due to ban threshold.`);

            }
            else if (unresolvedReportCount >= 10 && author.accountStatus !== 'banned') {
                 if (author.accountStatus !== 'warned') {
                    author.accountStatus = 'warned';
                    await author.save();
                    console.log(`User ${author._id} WARNED due to ${unresolvedReportCount} reports on ${targetType} ${targetId}`);
                }

                 await TargetModel.findByIdAndDelete(targetId);
                 console.log(`${targetType} ${targetId} DELETED due to warning threshold.`);
            }
        }

        // else if (targetType === 'Group') {
        //      if (unresolvedReportCount >= 20) {
        //         const group = await Group.findById(targetId).select('status');
        //         if (group && group.status !== 'inactive') {
        //             group.status = 'inactive';
        //             await group.save();
        //             console.log(`Group ${targetId} set to INACTIVE due to ${unresolvedReportCount} reports.`);
        //             // TODO: Maybe notify group admin? and close the chat box?
        //         }
        //      }
        // }

    } catch (error) {
        console.error(`Error handling report thresholds for ${targetType} ${targetId}:`, error);
    }
};
