const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, param, validationResult } = require('express-validator');

const { createPost, updatePost, deletePost, getPosts, getPostById, likePost, getPostsByChannelId,getPostsByAllChannels } = require('../controllers/postController');
const { createComment, getCommentsForPost } = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|pdf|doc|docx|txt|xls|xlsx|ppt|pptx/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype || extname) {
        cb(null, true);
    } else {
        cb(new Error(`File upload only supports the following filetypes: ${allowedTypes}`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 15 * 1024 * 1024
    }
});

const createCommentValidation = [
  body('content', 'Comment content cannot be empty').trim().notEmpty(),
  body('content', 'Comment content cannot exceed 1000 characters').isLength({ max: 1000 }),
  body('parentCommentId').optional({ nullable: true }).isMongoId().withMessage('Invalid parent comment ID format')
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const extractedErrors = errors.array().map(err => ({ field: err.param || err.location, message: err.msg }));
  return res.status(422).json({ success: false, errors: extractedErrors });
};

const postIdValidation = [
  param('postId', 'Invalid Post ID format').isMongoId()
];

const updatePostValidationRules = [
  body('content', 'Content cannot be empty').trim().notEmpty(),
  body('content', 'Content cannot exceed 2000 characters').isLength({ max: 2000 })
];



/**
 * @route   POST api/posts
 * @desc    Create a new post
 * @access  Private
 */
router.post(
    '/',
    protect,
    upload.array('files', 5),
    createPost
);

/**
 * @route   PUT api/posts/:postId
 * @desc    Update a post
 * @access  Private
 */
router.put(
  '/:postId',
  protect,
  postIdValidation,
  updatePostValidationRules,
  handleValidationErrors,
  updatePost
);

/**
 * @route   DELETE api/posts/:postId
 * @desc    Delete a post
 * @access  Private
 */
router.delete(
  '/:postId',
  protect,
  postIdValidation,
  handleValidationErrors,
  deletePost
);

/**
 * @route   GET api/posts
 * @desc    Get posts
 * @access  Private
 */
router.get('/', protect, getPosts); //shuld this be public, or keep protected?

/**
 * @route   GET api/posts/:postId
 * @desc    Get a post by ID
 * @access  Private
 */
router.get(
  '/:postId',
  protect,
  postIdValidation,
  handleValidationErrors,
  getPostById
);

//post with channelId
/**
 * @route   GET api/posts/channel/:channelId
 * @desc    Get posts by channel ID
 * @access  Private
 */
router.get(
  '/channel/:channelId',
  protect,
  param('channelId', 'Invalid Channel ID format').isMongoId(),
  handleValidationErrors,
  getPostsByChannelId
);
//post with all channels
/**
 * @route   GET api/posts/channels/allChannels
 * @desc    Get posts by all channels
 * @access  Private
 */
router.get(
  '/channels/allChannels',
  protect,
  handleValidationErrors,
  getPostsByAllChannels
);

/**
 * @route   POST api/posts/:postId/like
 * @desc    Like a post
 * @access  Private
 */
router.post(
  '/:postId/like',
  protect,
  postIdValidation,
  handleValidationErrors,
  likePost
);

/**
 * @route   POST api/posts/:postId/comments
 * @desc    Create a comment
 * @access  Private
 */
router.route('/:postId/comments')
    .post(
        protect,
        postIdValidation,
        createCommentValidation,
        handleValidationErrors,
        createComment
    )

/**
 * @route   GET api/posts/:postId/comments
 * @desc    Get comments for a post
 * @access  Private
 */
    .get(
        postIdValidation,
        handleValidationErrors,
        getCommentsForPost
    );

module.exports = router;