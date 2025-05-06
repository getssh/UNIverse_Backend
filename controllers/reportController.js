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


exports.createReport = async (req, res, next) => {
    const { targetType, targetId, reason } = req.body;
    const reportedById = req.user.id;

    if (!targetType || !targetId || !reason) {
        return res.status(400).json({ success: false, error: 'Please provide targetType, targetId, and reason.' });
    }
    const TargetModel = getModelForTargetType(targetType);
    if (!TargetModel) {
        return res.status(400).json({ success: false, error: `Invalid targetType: ${targetType}` });
    }
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
         return res.status(400).json({ success: false, error: `Invalid targetId format.` });
    }
     if (reason.trim().length < 5) {
          return res.status(400).json({ success: false, error: 'Reason must be at least 5 characters long.' });
     }

    const targetExists = await TargetModel.findById(targetId).select('_id reports');
    if (!targetExists) {
        return res.status(404).json({ success: false, error: `${targetType} not found with ID: ${targetId}` });
    }

    const existingReport = await Report.findOne({
        reportedBy: reportedById,
        targetType: targetType,
        targetId: targetId,
        resolved: false
    });

    if (existingReport) {
         return res.status(409).json({ success: false, error: `You have already reported this ${targetType.toLowerCase()}.` });
    }

    const reportData = {
        reportedBy: reportedById,
        targetType: targetType,
        targetId: targetId,
        reason: reason.trim(),
        resolved: false
    };
    const newReport = await Report.create(reportData);
    console.log(`Report ${newReport._id} created by ${reportedById} for ${targetType} ${targetId}`);

    if (TargetModel.schema.path('reports') instanceof mongoose.Schema.Types.Array) {
        await TargetModel.findByIdAndUpdate(
            targetId,
            { $addToSet: { reports: newReport._id } },
            { new: true, runValidators: true }
        );
        console.log(`Report ${newReport._id} linked to ${targetType} ${targetId}`);
    } else {
        console.warn(`Target model ${targetType} does not have a 'reports' array field defined in schema. Skipping link.`);
    }

    handleReportThresholds(targetType, targetId);

    res.status(201).json({
        success: true,
        message: `${targetType} reported successfully.`,
    });
};

exports.getReports = async (req, res, next) => {
    const filter = {};
    if (req.query.resolved === 'true') filter.resolved = true;
    if (req.query.resolved === 'false') filter.resolved = false;
    if (req.query.targetType) {
        const allowedTypes = Report.schema.path('targetType').enumValues;
         if (allowedTypes.includes(req.query.targetType)) {
            filter.targetType = req.query.targetType;
         } else {
              return res.status(400).json({ success: false, error: `Invalid targetType filter.` });
         }
    }
     if (req.query.targetId) {
          if (mongoose.Types.ObjectId.isValid(req.query.targetId)) {
              filter.targetId = req.query.targetId;
          } else {
               return res.status(400).json({ success: false, error: `Invalid targetId filter format.` });
          }
     }
     if (req.query.reportedById) {
         if (mongoose.Types.ObjectId.isValid(req.query.reportedById)) {
             filter.reportedBy = req.query.reportedById;
         } else {
               return res.status(400).json({ success: false, error: `Invalid reportedById filter format.` });
         }
     }
     if (req.query.resolvedById) {
          if (mongoose.Types.ObjectId.isValid(req.query.resolvedById)) {
              filter.resolvedBy = req.query.resolvedById;
          } else {
                return res.status(400).json({ success: false, error: `Invalid resolvedById filter format.` });
          }
     }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const sort = { resolved: 1, createdAt: -1 };

    const reports = await Report.find(filter)
        .populate('reportedBy', 'name email')
        .populate('targetId')
        .populate('resolvedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

    const totalReports = await Report.countDocuments(filter);
    const totalPages = Math.ceil(totalReports / limit);

    res.status(200).json({
        success: true,
        count: reports.length,
        pagination: { totalReports, totalPages, currentPage: page, limit },
        data: reports
    });
};

exports.resolveReport = async (req, res, next) => {
  const { reportId } = req.params;
  const { resolved = true, actionTaken, adminNotes } = req.body;
  const resolvedById = req.user.id;

   if (actionTaken) {
       const allowedActions = Report.schema.path('actionTaken').enumValues;
       if (!allowedActions.includes(actionTaken)) {
            return res.status(400).json({ success: false, error: `Invalid actionTaken value. Allowed: ${allowedActions.join(', ')}` });
       }
   }

  const updateData = {
      resolved: resolved,
      resolvedBy: resolved ? resolvedById : undefined,
      actionTaken: resolved ? actionTaken : undefined,
      adminNotes: resolved ? adminNotes?.trim() : undefined,
  };

  const updatedReport = await Report.findByIdAndUpdate(reportId, updateData, {
      new: true,
      runValidators: true
  })
  .populate('reportedBy', 'name email')
  .populate('targetId')
  .populate('resolvedBy', 'name email');


  if (!updatedReport) {
      return res.status(404).json({ success: false, error: `Report not found with ID: ${reportId}` });
  }

  console.log(`Report ${reportId} resolved successfully by admin ${resolvedById}`);

  handleReportThresholds(updatedReport.targetType, updatedReport.targetId); 

  res.status(200).json({
      success: true,
      data: updatedReport
  });
};
