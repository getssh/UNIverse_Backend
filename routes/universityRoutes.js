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

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) cb(null, true);
    else cb(new Error('Logo must be an image file.'), false);
};
const uploadLogo = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 }
});


const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();
    const extractedErrors = errors.array().map(err => ({ field: err.param || err.location, message: err.msg }));
    return res.status(422).json({ success: false, errors: extractedErrors });
};

const universityIdValidation = [
    param('universityId', 'Invalid University ID format').isMongoId()
];

const updateUniversityBodyValidation = [
  body('name', 'University name is required').optional().trim().notEmpty(),
  body('universityAdmins').optional().isArray(), 
  body('universityAdmins.*').optional().isMongoId(),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('location').optional().trim().isLength({ max: 200 }),
  body('websiteUrl').optional({ checkFalsy: true }).trim().isURL().withMessage('Please provide a valid website URL.'),
  body('logoUrl').optional({ checkFalsy: true }).trim().isURL().withMessage('Please provide a valid logo URL.'),
  body('contactEmail').optional({ checkFalsy: true }).trim().isEmail().normalizeEmail().withMessage('Please provide a valid contact email.'),
  body('contactPhone').optional().trim(),
  body('universityAdmins').optional().isArray().withMessage('universityAdmins must be an array.'),
  body('universityAdmins.*').optional().isMongoId().withMessage('Each universityAdmin ID must be valid.'),
  body('status').optional().isIn(['pending_approval', 'active', 'suspended', 'inactive'])
               .withMessage('Invalid status value.')
];

const createUniversityBodyValidation = [
    body('name', 'University name is required').trim().notEmpty().isLength({ max: 150 }),
    body('universityAdmins').optional().isArray(), 
    body('universityAdmins.*').optional().isMongoId(),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('location').optional().trim().isLength({ max: 200 }),
    body('websiteUrl').optional({ checkFalsy: true }).trim().isURL().withMessage('Please provide a valid website URL.'),
    body('logoUrl').optional({ checkFalsy: true }).trim().isURL().withMessage('Please provide a valid logo URL.'),
    body('contactEmail').optional({ checkFalsy: true }).trim().isEmail().normalizeEmail().withMessage('Please provide a valid contact email.'),
    body('contactPhone').optional().trim(),
    body('universityAdmins').optional().isArray().withMessage('universityAdmins must be an array.'),
    body('universityAdmins.*').optional().isMongoId().withMessage('Each universityAdmin ID must be valid.'),
    body('status').optional().isIn(['pending_approval', 'active', 'suspended', 'inactive'])
                 .withMessage('Invalid status value.')
];

const getUniversitiesQueryValidation = [
     query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer.'),
     query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be an integer between 1 and 100.'), 
     query('search').optional().trim().escape()
];



router.route('/')
    .post(
      protect,
      authorize(['admin']),
      uploadLogo.single('logo'),
      createUniversityBodyValidation,
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
      authorize(['admin']),
      uploadLogo.single('logo'),
      universityIdValidation,
      updateUniversityBodyValidation,
      handleValidationErrors,
      updateUniversity
    )
    .delete(
        protect,
        authorize(['admin']),
        universityIdValidation,
        handleValidationErrors,
        deleteUniversity
    );

module.exports = router;
