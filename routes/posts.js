const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, param, validationResult } = require('express-validator');

const { createPost, updatePost, deletePost, getPosts, getPostById, likePost, getPostsByChannelId } = require('../controllers/postController');
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



router.post(
    '/',
    protect,
    upload.array('files', 5),
    createPost
);

router.put(
  '/:postId',
  protect,
  postIdValidation,
  updatePostValidationRules,
  handleValidationErrors,
  updatePost
);

router.delete(
  '/:postId',
  protect,
  postIdValidation,
  handleValidationErrors,
  deletePost
);

router.get('/', protect, getPosts); //shuld this be public, or keep protected?

router.get(
  '/:postId',
  protect,
  postIdValidation,
  handleValidationErrors,
  getPostById
);

//post with channelId
router.get(
  '/channel/:channelId',
  protect,
  param('channelId', 'Invalid Channel ID format').isMongoId(),
  handleValidationErrors,
  getPostsByChannelId
);

router.put(
  '/:postId/like',
  protect,
  postIdValidation,
  handleValidationErrors,
  likePost
);

router.route('/:postId/comments')
    .post(
        protect,
        postIdValidation,
        createCommentValidation,
        handleValidationErrors,
        createComment
    )
    .get(
        postIdValidation,
        handleValidationErrors,
        getCommentsForPost
    );

module.exports = router;