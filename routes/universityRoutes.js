const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer')


const {
    createUniversity,
    getUniversities,
    getUniversityById,
    updateUniversity,
    deleteUniversity
} = require('../controllers/universityController');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer()


const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    const extractedErrors = errors.array().map(err => ({ field: err.param || err.location, message: err.msg }));
    return res.status(422).json({ success: false, errors: extractedErrors });
};

const universityIdValidation = [
    param('universityId', 'Invalid University ID format').isMongoId()
];

const universityBodyValidation = [
    body('name', 'University name is required').trim().notEmpty().isLength({ max: 150 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('location').optional().trim().isLength({ max: 200 }),
    body('websiteUrl').optional({ checkFalsy: true }).trim().isURL().withMessage('Please provide a valid website URL.'),
    body('logoUrl').optional({ checkFalsy: true }).trim().isURL().withMessage('Please provide a valid logo URL.'),
    body('contactEmail').optional({ checkFalsy: true }).trim().isEmail().normalizeEmail().withMessage('Please provide a valid contact email.'),
    body('contactPhone').optional().trim()
];

const getUniversitiesQueryValidation = [
     query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer.'),
     query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be an integer between 1 and 100.'), 
     query('search').optional().trim().escape()
];



router.route('/')
    .post(
        protect,
        authorize('admin'),
        upload.single('logo'),
        universityBodyValidation,
        handleValidationErrors,
        createUniversity
    )
    .get(
        getUniversitiesQueryValidation,
        handleValidationErrors,
        getUniversities
    );



router.route('/:universityId')
    .get(
        universityIdValidation,
        handleValidationErrors,
        getUniversityById
    )
    .put(
        protect,
        authorize('admin'), 
        universityIdValidation,
        universityBodyValidation,
        handleValidationErrors, 
        updateUniversity 
    )
    .delete(
        protect,
        authorize('admin'),
        universityIdValidation,
        handleValidationErrors,
        deleteUniversity
    );

module.exports = router;
