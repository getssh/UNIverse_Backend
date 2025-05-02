const Comment = require('../models/Comment');
const Post = require('../models/Post');
const mongoose = require('mongoose');


exports.createComment = async (req, res, next) => {
    const { postId } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.user.id;

    if (!content || content.trim() === '') {
        return res.status(400).json({ success: false, error: 'Comment content cannot be empty.' });
    }

    const postExists = await Post.findById(postId);
    if (!postExists) {
        return res.status(404).json({ success: false, error: `Post not found with ID: ${postId}` });
    }

    const commentData = {
        content: content.trim(),
        postId: postId,
        createdBy: userId,
        parentCommentId: null
    };

    if (parentCommentId) {
        if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
             return res.status(400).json({ success: false, error: `Invalid parent comment ID format.` });
        }
        const parentComment = await Comment.findById(parentCommentId);
        if (!parentComment) {
            return res.status(404).json({ success: false, error: `Parent comment not found with ID: ${parentCommentId}` });
        }

        if (parentComment.postId.toString() !== postId) {
             return res.status(400).json({ success: false, error: `Parent comment does not belong to post ID: ${postId}` });
        }
        commentData.parentCommentId = parentCommentId;
    }

    let newComment = await Comment.create(commentData);
    console.log(`Comment created successfully with ID: ${newComment._id}`);

    newComment = await Comment.findById(newComment._id)
                                .populate('createdBy', 'name profilePicUrl')
                                .lean();

    res.status(201).json({
        success: true,
        data: newComment
    });
};


exports.getCommentsForPost = async (req, res, next) => {
    const { postId } = req.params;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    const sort = req.query.sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

    const postExists = await Post.findById(postId);
     if (!postExists) {
         return res.status(404).json({ success: false, error: `Post not found with ID: ${postId}` });
     }

    const queryFilter = {
        postId: postId,
        parentCommentId: null
    };

    const comments = await Comment.find(queryFilter)
        .populate('createdBy', 'name profilePicUrl')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

    const totalComments = await Comment.countDocuments(queryFilter);
    const totalPages = Math.ceil(totalComments / limit);

    // TODO: fetching reply counts for each comment efficiently if needed for UI

    res.status(200).json({
        success: true,
        count: comments.length,
        pagination: {
            totalComments,
            totalPages,
            currentPage: page,
            limit
        },
        data: comments
    });
};


exports.updateComment = async (req, res, next) => {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim() === '') {
        return res.status(400).json({ success: false, error: 'Comment content cannot be empty.' });
    }
     if (content.length > 1000) {
        return res.status(400).json({ success: false, error: 'Comment cannot exceed 1000 characters.' });
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
        return res.status(404).json({ success: false, error: `Comment not found with ID: ${commentId}` });
    }

    if (comment.createdBy.toString() !== userId) {
        return res.status(403).json({ success: false, error: 'User not authorized to update this comment' });
    }

    comment.content = content.trim();
    comment.isEdited = true;

    await comment.save();

    await comment.populate('createdBy', 'name profilePicUrl');

    console.log(`Comment ${commentId} updated successfully by user ${userId}`);
    res.status(200).json({
        success: true,
        data: comment
    });
};

exports.deleteComment = async (req, res, next) => {
    const { commentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const comment = await Comment.findById(commentId);

    if (!comment) {
        return res.status(404).json({ success: false, error: `Comment not found with ID: ${commentId}` });
    }

    const isOwner = comment.createdBy.toString() === userId;
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, error: 'User not authorized to delete this comment' });
    }

    const deletedComment = await Comment.findByIdAndDelete(commentId);

     if (!deletedComment) {
          return res.status(404).json({ success: false, error: `Comment not found with ID: ${commentId} during delete attempt.` });
     }

    console.log(`Comment ${commentId} deleted successfully by user ${userId} (Role: ${userRole})`);

    res.status(200).json({ success: true, message: 'Comment deleted successfully.' });
};


exports.likeComment = async (req, res, next) => {
    const { commentId } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findById(commentId);

    if (!comment) {
        return res.status(404).json({ success: false, error: `Comment not found with ID: ${commentId}` });
    }

    const isLiked = comment.likes.some(likeUserId => likeUserId.equals(userId));

    let message;

    if (isLiked) {
        comment.likes.pull(userId); 
        message = 'Comment unliked successfully.';
        console.log(`User ${userId} unliking comment ${commentId}`);
    } else {
        comment.likes.addToSet(userId); 
        message = 'Comment liked successfully.';
        console.log(`User ${userId} liking comment ${commentId}`);
    }

    await comment.save();

    const updatedComment = await Comment.findById(commentId)
                                     .populate('createdBy', 'name profilePicUrl')
                                     .lean();

    if (!updatedComment) {
         console.error(`Failed to refetch comment ${commentId} after like/unlike save.`);
         return res.status(404).json({ success: false, error: `Comment not found after update operation.` });
    }


    res.status(200).json({
        success: true,
        message: message,
        data: updatedComment
    });
};
