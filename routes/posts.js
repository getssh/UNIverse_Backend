const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, param, validationResult } = require('express-validator');

const { createPost, updatePost, deletePost, getPosts } = require('../controllers/postController');
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
    upload.array('postFiles', 5),
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

module.exports = router;