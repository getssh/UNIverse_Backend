const Post = require('../models/Post');
const Group = require('../models/Group');
const Channel = require('../models/Channel');
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const { getResourceTypeFromMime } = require('../utils/fileUtils');
const cloudinary = require('../config/cloudinary');
const { checkTextContent, checkImageContent } = require('../utils/moderationService');


exports.createPost = async (req, res, next) => {
    const { content, groupId, channelId } = req.body;
    const userId = req.user.id;
    const files = req.files;

    if (!content && (!files || files.length === 0)) {
        return res.status(400).json({ success: false, error: 'Post must have content or at least one file.' });
    }
    if (groupId && channelId) {
        return res.status(400).json({ success: false, error: 'A post cannot belong to both a group and a channel.' });
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
            if (!channelExists) {
                return res.status(404).json({ success: false, error: `Channel not found with ID: ${channelId}` });
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
         // TODO: Add cleanup logic here? If Cloudinary uploads succeeded but Post.create failed (maybe handle in d/t way latter)
         // the files are orphaned. This is complex to handle transactionally without 2PC.
         // Simplest approach for now is logging. More advanced: attempt to delete uploaded files in catch.
        //  if (uploadedFilesData.length > 0 && error.name !== 'ValidationError') {
        //     console.warn("Post creation failed after files were uploaded. Attempting cleanup (best effort)...");
        //      uploadedFilesData.forEach(fileData => {
        //          if (fileData.publicId) {
        //              cloudinary.uploader.destroy(fileData.publicId, { resource_type: fileData.resourceType || 'auto' })
        //                  .then(delResult => console.log(`Cleanup: Deleted orphaned Cloudinary file ${fileData.publicId}`, delResult))
        //                  .catch(delErr => console.error(`Cleanup Error: Failed to delete orphaned Cloudinary file ${fileData.publicId}`, delErr));
        //          }
        //      });
        //  }

        next(error);
    }
};

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
          .populate('group', 'name') //populate group and channel names, can be deleted if not necessary 
          .populate('channel', 'name')
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