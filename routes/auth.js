const express = require('express');
const { body, validationResult } = require('express-validator');

const { registerUser } = require('../controllers/authController');

const router = express.Router();

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
    body('name', 'Name is required and cannot be empty')
        .trim() 
        .notEmpty()
        .escape(), 
    body('email', 'Please provide a valid email address')
        .isEmail()
        .normalizeEmail(),
    body('password', 'Password must be at least 8 characters long')
        .isLength({ min: 8 })
        .trim(), 
    body('role', 'Role must be either "student" or "teacher"')
        .isIn(['student', 'teacher']),

];


router.post(
    '/register',
    registrationValidationRules, 
    handleValidationErrors,    
    registerUser 
);


module.exports = router;