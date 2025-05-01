const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');

const { registerUser, verifyEmail} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload only images.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});


// --- Input Validation Middleware ---

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }
    const extractedErrors = errors.array().map(err => ({ field: err.param, message: err.msg }));
    return res.status(422).json({
        success: false,
        errors: extractedErrors,
    });
};

const registrationValidationRules = [
    body('name', 'Name is required').trim().notEmpty().escape(),
    body('email', 'Please include a valid email').isEmail().normalizeEmail(),
    body('password', 'Password must be at least 8 characters').isLength({ min: 8 }).trim(),
    body('role', 'Role must be either student or teacher').isIn(['student', 'teacher']),
    body('university').optional().isMongoId().withMessage('Invalid University ID format'),
    body('department').optional().trim().escape(),
    body('faculty').optional().trim().escape(),
    body('studyLevel').optional().isIn(['undergraduate', 'graduate', 'PhD']),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('phoneNumber').optional().trim().isMobilePhone('any', { strictMode: false }).withMessage('Invalid phone number format'),
];


// --- Authentication Routes ---

router.post(
    '/register',
    upload.fields([
        { name: 'profilePic', maxCount: 1 },
        { name: 'idCard', maxCount: 1 }
    ]),
    registrationValidationRules,
    handleValidationErrors,
    registerUser
);

router.get('/verify-email/:token', verifyEmail);

module.exports = router;