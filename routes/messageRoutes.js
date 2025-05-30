const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');

const {
    sendMessage,
    getMessagesForChat,
    editMessage,
    deleteMessage,
    markMessagesAsRead,
    getFilesForChat
} = require('../controllers/messageController');

const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|pdf|doc|docx|txt|xls|xlsx|ppt|pptx|zip|rar|mp3|wav/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = require('path').extname(file.originalname).toLowerCase();

    if (mimetype || allowedTypes.test(extname)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed. Please upload common image, video, document, or audio files.`), false);
    }
};
const uploadMessageFile = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only images (JPEG, PNG, GIF) and PDF files are allowed'), false);
        }
    },
    limits: { 
        fileSize: 10 * 1024 * 1024,
        files: 1 // Limit to single file
    }
});

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
const messageIdValidation = [param('messageId', 'Invalid Message ID format').isMongoId()];

const sendMessageBodyValidation = [
    body('chatId', 'Chat ID is required').isMongoId(),
    body('content').optional({ checkFalsy: true }).trim().isLength({ max: 2000 })
                   .withMessage('Message content cannot exceed 2000 characters.'),
    body().custom((value, { req }) => {
        if (!req.body.content && !req.file) {
            throw new Error('Message must have content or a file.');
        }
        return true;
    })
];
const editMessageBodyValidation = [
    body('content', 'Message content cannot be empty').trim().notEmpty()
                   .isLength({ max: 2000 }).withMessage('Message content cannot exceed 2000 characters.')
];

const getMessagesQueryValidation = [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
];

/**
 * @route   POST api/messages
 * @desc    Send a message
 * @access  Private
 */
router.post(
    '/',
    protect,
    uploadMessageFile.single('messageFile'),
    sendMessageBodyValidation,
    handleValidationErrors,
    sendMessage
);

/**
 * @route   GET api/messages/:chatId
 * @desc    Get messages for a chat
 * @access  Private
 */
router.get(
    '/:chatId',
    protect,
    chatIdValidation,
    getMessagesQueryValidation,
    handleValidationErrors,
    getMessagesForChat
);

/**
 * @route   GET api/messages/files/:chatId
 * @desc    Get files for a chat
 * @access  Private
 */
router.get(
    '/files/:chatId',
    protect,
    chatIdValidation,
    getMessagesQueryValidation,
    handleValidationErrors,
    getFilesForChat
);

/**
 * @route   POST api/messages/:messageId
 * @desc    Edit a message
 * @access  Private
 */
router.post(
    '/:messageId',
    protect,
    messageIdValidation,
    editMessageBodyValidation,
    handleValidationErrors,
    editMessage
);


/**
 * @route   DELETE api/messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
router.delete(
    '/:messageId',
    protect,
    messageIdValidation,
    handleValidationErrors,
    deleteMessage
);

/**
 * @route   PUT api/messages/read/:chatId
 * @desc    Mark messages as read
 * @access  Private
 */
router.put(
    '/read/:chatId',
    protect,
    chatIdValidation,
    handleValidationErrors,
    markMessagesAsRead
);


module.exports = router;