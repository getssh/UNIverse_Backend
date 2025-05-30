const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { getOrCreateOneOnOneChat, getUserChats, getChatById } = require('../controllers/chatController');

const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    const extractedErrors = errors.array().map(err => ({
        field: err.param || err.location || (err.nestedErrors ? err.nestedErrors[0]?.param : 'unknown'),
        message: err.msg
    }));
    return res.status(422).json({ success: false, errors: extractedErrors });
};

const chatIdValidation = [param('chatId', 'Invalid Chat ID format').isMongoId()];
const userIdValidation = [body('recipientId', 'Invalid Recipient User ID format').isMongoId()];

const getChatsQueryValidation = [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
];

/**
 * @route   POST api/chats/one-on-one
 * @desc    Create a one-on-one chat
 * @access  Private
 */
router.post(
    '/one-on-one',
    protect,
    userIdValidation,
    handleValidationErrors,
    getOrCreateOneOnOneChat
);

/**
 * @route   GET api/chats
 * @desc    Get user chats
 * @access  Private
 */
router.get(
    '/',
    protect,
    getChatsQueryValidation,
    handleValidationErrors,
    getUserChats
);

/**
 * @route   GET api/chats/:chatId
 * @desc    Get a chat by ID
 * @access  Private
 */
router.get(
    '/:chatId',
    protect,
    chatIdValidation,
    handleValidationErrors,
    getChatById
);

module.exports = router;