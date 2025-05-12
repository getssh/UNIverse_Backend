const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');

const {
    sendMessage,
    getMessagesForChat,
    editMessage,
    deleteMessage,
    markMessagesAsRead
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
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
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

router.post(
    '/',
    protect,
    uploadMessageFile.single('messageFile'),
    sendMessageBodyValidation,
    handleValidationErrors,
    sendMessage
);

router.get(
    '/:chatId',
    protect,
    chatIdValidation,
    getMessagesQueryValidation,
    handleValidationErrors,
    getMessagesForChat
);

router.put(
    '/:messageId',
    protect,
    messageIdValidation,
    editMessageBodyValidation,
    handleValidationErrors,
    editMessage
);


router.delete(
    '/:messageId',
    protect,
    messageIdValidation,
    handleValidationErrors,
    deleteMessage
);

router.put(
    '/read/:chatId',
    protect,
    chatIdValidation,
    handleValidationErrors,
    markMessagesAsRead
);


module.exports = router;