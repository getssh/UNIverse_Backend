const express = require('express');
const { body, param, validationResult } = require('express-validator');


const {
    updateComment,
    deleteComment,
    likeComment
} = require('../controllers/commentController');


const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    const extractedErrors = errors.array().map(err => ({ field: err.param || err.location, message: err.msg }));
    return res.status(422).json({ success: false, errors: extractedErrors });
};

const commentIdValidation = [
    param('commentId', 'Invalid Comment ID format').isMongoId()
];

const updateCommentValidation = [
    body('content', 'Comment content cannot be empty').trim().notEmpty(),
    body('content', 'Comment content cannot exceed 1000 characters').isLength({ max: 1000 })
];


router.put(
    '/:commentId',
    protect,
    commentIdValidation,
    updateCommentValidation,
    handleValidationErrors,
    updateComment
);


router.delete(
    '/:commentId',
    protect,
    commentIdValidation,
    handleValidationErrors,
    deleteComment
);

router.put(
    '/:commentId/like',
    protect,
    commentIdValidation,
    handleValidationErrors,
    likeComment
);


module.exports = router;