const Post = require('../models/Post');
const Group = require('../models/Group');
const User = require('../models/User')
const Channel = require('../models/Channel');
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const { getResourceTypeFromMime } = require('../utils/fileUtils');
const cloudinary = require('../config/cloudinary');
const { checkTextContent, checkImageContent } = require('../utils/moderationService');

/**
 * Creates a new post with optional file attachments
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing post data
 * @param {string} req.body.content - Text content of the post
 * @param {string} [req.body.groupId] - ID of the group if post belongs to a group
 * @param {string} [req.body.channelId] - ID of the channel if post belongs to a channel
 * @param {Array} [req.files] - Array of files to be attached to the post
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with created post data or error message
 * @throws {Error} If post creation fails or file upload fails
 */
exports.createPost = async (req, res, next) => {
    const { content, groupId, channelId } = req.body;
    const userId = req.user.id;
    const files = req.files || [];

    if (!content && (!files || files.length === 0)) {
        return res.status(400).json({ success: false, error: 'Post must have content or at least one file.' });
    }
    if (groupId && channelId) {
        return res.status(400).json({ success: false, error: 'A post cannot belong to both a group and a channel.' });
    }
    if (!groupId && !channelId) {
        return res.status(400).json({ success: false, error: 'A post must belong to a group or channel' });
    }

    const uploadedFilesData = [];

    try {
        if (groupId) {
            const groupExists = await Group.findById(groupId);
            if (!groupExists) {
                return res.status(404).json({ success: false, error: `Group not found with ID: ${groupId}` });
            }
        }
        if (channelId) {
            const channelExists = await Channel.findById(channelId);
            const logedInUser = await User.findById(userId);
            const userUniversity = logedInUser.university;

            if (!userUniversity) {
                return res.status(401).json({success: false, error: `User not associated with a university`})
            }

            if (!channelExists) {
                return res.status(404).json({success: false, error: `Channel not found with ID: ${channelId}`})
            }

            const channelUniversity = channelExists.university;
            const isSameUniversity = userUniversity.equals(channelUniversity);

          if (!isSameUniversity) {
                return res.status(401).json({success: false, error: `Not authorized to create a post in this channel`})
            }
        }

        if (files && files.length > 0) {
            console.log(`Processing ${files.length} file(s) for upload...`);
            const uploadPromises = files.map(async (file) => {
                try {
                     const resourceType = getResourceTypeFromMime(file.mimetype);
                     console.log(`Uploading ${file.originalname} as ${resourceType}...`);

                    const result = await uploadToCloudinary(
                        file.buffer,
                        file.originalname,
                        'post_files', //folder for post files(update later if we need to separte folders for group and channel posts)
                        resourceType 
                    );
                    
                    const fileData = {
                      url: result.secure_url,
                      publicId: result.public_id,
                      resourceType: resourceType
                    };

                    return fileData;
                } catch (uploadError) {
                    console.error(`Failed to upload ${file.originalname}:`, uploadError);
  
                    throw new Error(`Failed to upload file: ${file.originalname}. ${uploadError.message}`);
                }
            });

            const results = await Promise.all(uploadPromises);
            uploadedFilesData.push(...results);
            console.log('All files uploaded successfully.');
        }

        let textSafe = true;
        if (content) {
          const textCheck = await checkTextContent(content);
          textSafe = textCheck.isSafe;
          if (!textSafe) {
            return res.status(403).json({ success: false, error: 'Text content is inappropriate', details: textCheck.details });
          }
        }

        for (const fileData of uploadedFilesData) {
          const imageCheck = await checkImageContent(fileData.url);
          if (!imageCheck.isSafe) {
            return res.status(403).json({ success: false, error: 'Image content is inappropriate', details: imageCheck.details });
          }
        }

        const postData = {
            content: content || '',
            createdBy: userId,
            files: uploadedFilesData,
            group: groupId || undefined,
            channel: channelId || undefined,
            isEdited: false,
            likes: [],
            reports: [],
        };

        let newPost = await Post.create(postData);
        console.log(`Post created successfully with ID: ${newPost._id}`);

        newPost = await Post.findById(newPost._id).populate('createdBy', 'name profilePicUrl');

        res.status(201).json({
            success: true,
            data: newPost
        });

    } catch (error) {
         console.error("Error creating post:", error);
         // TODO: change cleanup logic here? If Cloudinary uploads succeeded but Post.create failed (maybe handle in d/t way latter)
         if (uploadedFilesData.length > 0 && error.name !== 'ValidationError') {
            console.warn("Post creation failed after files were uploaded. Attempting cleanup (best effort)...");
             uploadedFilesData.forEach(fileData => {
                 if (fileData.publicId) {
                     cloudinary.uploader.destroy(fileData.publicId, { resource_type: fileData.resourceType || 'auto' })
                         .then(delResult => console.log(`Cleanup: Deleted orphaned Cloudinary file ${fileData.publicId}`, delResult))
                         .catch(delErr => console.error(`Cleanup Error: Failed to delete orphaned Cloudinary file ${fileData.publicId}`, delErr));
                 }
             });
         }

        next(error);
    }
};

/**
 * Updates an existing post's content
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.postId - ID of the post to update
 * @param {Object} req.body - Request body containing update data
 * @param {string} req.body.content - New content for the post
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with updated post data or error message
 * @throws {Error} If post update fails
 */
exports.updatePost = async (req, res, next) => {
  const { postId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  if (content === undefined || content === null || content.trim() === '') {
      // Allow empty string if user intentionally clears content?

      return res.status(400).json({ success: false, error: 'Post content cannot be empty for an update.' });
  }
   if (content.length > 2000) {
      return res.status(400).json({ success: false, error: 'Post content cannot exceed 2000 characters.' });
  }


  try {
      const post = await Post.findById(postId);

      if (!post) {
          return res.status(404).json({ success: false, error: `Post not found with ID: ${postId}` });
      }

      if (post.createdBy.toString() !== userId) {
          return res.status(403).json({ success: false, error: 'User not authorized to update this post' });
      }

      post.content = content.trim();
      post.isEdited = true;

      const updatedPost = await post.save();

      await updatedPost.populate('createdBy', 'name profilePicUrl');

      console.log(`Post ${postId} updated successfully by user ${userId}`);

      res.status(200).json({
          success: true,
          data: updatedPost
      });

  } catch (error) {
      console.error(`Error updating post ${postId}:`, error);
      next(error);
  }
};

/**
 * Deletes a post by ID
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.postId - ID of the post to delete
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with success message or error
 * @throws {Error} If post deletion fails
 */
exports.deletePost = async (req, res, next) => {
  const { postId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
      const post = await Post.findById(postId);

      if (!post) {
          return res.status(404).json({ success: false, error: `Post not found with ID: ${postId}` });
      }

      const isOwner = post.createdBy.toString() === userId;
      const isAdmin = userRole === 'admin';

      if (!isOwner && !isAdmin) {
          return res.status(403).json({ success: false, error: 'User not authorized to delete this post' });
      }

      const deletedPost = await Post.findByIdAndDelete(postId);

      if (!deletedPost) {
            return res.status(404).json({ success: false, error: `Post not found with ID: ${postId} during delete attempt.` });
      }

      console.log(`Post ${postId} deleted successfully by user ${userId} (Role: ${userRole})`);

      res.status(200).json({ success: true, message: 'Post deleted successfully.' });

  } catch (error) {
      console.error(`Error deleting post ${postId}:`, error);
      next(error);
  }
};

/**
 * Retrieves posts with pagination and filtering options
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of posts per page
 * @param {string} [req.query.groupId] - Filter posts by group ID
 * @param {string} [req.query.channelId] - Filter posts by channel ID
 * @param {string} [req.query.userId] - Filter posts by user ID
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with paginated posts data
 * @throws {Error} If post retrieval fails
 */
exports.getPosts = async (req, res, next) => {
  try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;

      let queryFilter = {};
      if (req.query.groupId) {
          queryFilter.group = req.query.groupId;
      } else if (req.query.channelId) {
          queryFilter.channel = req.query.channelId;
      } else if (req.query.userId) {
          queryFilter.createdBy = req.query.userId;
      } else {
      }

      const posts = await Post.find(queryFilter)
          .populate('createdBy', 'name profilePicUrl')
          .populate('group', 'name') 
          .populate('channel', 'name')
          .populate('commentCount')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

      const totalPosts = await Post.countDocuments(queryFilter);
      const totalPages = Math.ceil(totalPosts / limit);

      res.status(200).json({
          success: true,
          count: posts.length,
          pagination: {
              totalPosts,
              totalPages,
              currentPage: page,
              limit
          },
          data: posts
      });

  } catch (error) {
      console.error("Error getting posts:", error);
      next(error);
  }
};

/**
 * Retrieves a single post by its ID
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.postId - ID of the post to retrieve
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with post data or error message
 * @throws {Error} If post retrieval fails
 */
exports.getPostById = async (req, res, next) => {
  const { postId } = req.params;

  try {
      const post = await Post.findById(postId)
          .populate('createdBy', 'name profilePicUrl email')
          .populate('group')
          .populate('channel')
          .lean();

      if (!post) {
          return res.status(404).json({ success: false, error: `Post not found with ID: ${postId}` });
      }

      res.status(200).json({
          success: true,
          data: post
      });

  } catch (error) {
      if (error.name === 'CastError') {
           return res.status(404).json({ success: false, error: `Post not found with ID: ${postId}` });
      }
      console.error(`Error getting post ${postId}:`, error);
      next(error);
  }
};

/**
 * Toggles like status for a post
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.postId - ID of the post to like/unlike
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with updated post data and like status
 * @throws {Error} If like operation fails
 */
exports.likePost = async (req, res, next) => {
  const { postId } = req.params;
  const userId = req.user.id;

  try {
      const post = await Post.findById(postId);

      if (!post) {
          return res.status(404).json({ success: false, error: `Post not found with ID: ${postId}` });
      }

      const isLiked = post.likes.some(likeUserId => likeUserId.equals(userId));

      let message;

      if (isLiked) {
          post.likes.pull(userId);
          message = 'Post unliked successfully.';
          console.log(`User ${userId} unliking post ${postId}`);
      } else {
          post.likes.addToSet(userId);
          message = 'Post liked successfully.';
          console.log(`User ${userId} liking post ${postId}`);
      }

      await post.save();
      console.log(`Post ${postId} likes updated in DB.`);


      const updatedPost = await Post.findById(postId)
                                    .populate('createdBy', 'name profilePicUrl')
                                    .lean();

      if (!updatedPost) {
           console.error(`Failed to refetch post ${postId} after like/unlike save.`);
           return res.status(404).json({ success: false, error: `Post not found after update operation.` });
      }

      res.status(200).json({
          success: true,
          message: message,
          data: updatedPost
      });

  } catch (error) {
      console.error(`Error liking/unliking post ${postId}:`, error);
      next(error);
  }
};

/**
 * Retrieves all posts for a specific channel
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.channelId - ID of the channel to get posts from
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with channel posts data
 * @throws {Error} If post retrieval fails
 */
exports.getPostsByChannelId = async (req, res, next) => {
    const { channelId } = req.params;
  
    try {
      const posts = await Post.find({ channel: channelId })
        .populate('createdBy', 'name profilePicUrl')
        .populate('group')
        .populate('channel')
        .populate('commentCount')
        .sort({ createdAt: -1 })
        .lean();
  
      res.status(200).json({
        success: true,
        count: posts.length,
        data: posts, // this will be an empty array if no posts are found
      });
    } catch (error) {
      console.error(`Error getting posts for channel ${channelId}:`, error);
      next(error);
    }
  };

/**
 * Retrieves posts from all channels, sorted by likes count
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of posts per page
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with paginated posts data sorted by likes
 * @throws {Error} If post retrieval fails
 */
exports.getPostsByAllChannels = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .populate('createdBy', 'name profilePicUrl')
      .populate('group')
      .populate({
        path: 'channel',
        populate: {
          path: 'university',
          select: 'name logo.url'
        }
      })
      .populate('commentCount')
      .sort({ likes: -1 }) // Sort by likes in descending order
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPosts = await Post.countDocuments();
    const totalPages = Math.ceil(totalPosts / limit);

    res.status(200).json({
      success: true,
      count: posts.length,
      pagination: {
        totalPosts,
        totalPages,
        currentPage: page,
        limit,
      },
      data: posts,
    });
  } catch (error) {
    console.error("Error getting posts:", error);
    next(error);
  }
};

  