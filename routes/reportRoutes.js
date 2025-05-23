const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const {
    createReport,
    getReports,
    resolveReport
} = require('../controllers/reportController');

const { protect, authorize } = require('../middleware/authMiddleware');

const Report = require('../models/Report');
const reportTargetTypes = Report.schema.path('targetType').enumValues;
const reportActionTakenValues = Report.schema.path('actionTaken').enumValues;

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

const createReportValidation = [
    body('targetType', `Target type must be one of: ${reportTargetTypes.join(', ')}`)
        .isIn(reportTargetTypes),
    body('targetId', 'Target ID must be a valid ID').isMongoId(),
    body('reason', 'Reason is required and must be between 5 and 1000 characters')
        .trim().isLength({ min: 5, max: 1000 })
];

const getReportsQueryValidation = [
    query('resolved').optional().isBoolean().withMessage('Resolved must be true or false.').toBoolean(),
    query('targetType').optional().isIn(reportTargetTypes)
        .withMessage(`Target type must be one of: ${reportTargetTypes.join(', ')}`),
    query('targetId').optional().isMongoId().withMessage('Invalid Target ID format.'),
    query('reportedById').optional().isMongoId().withMessage('Invalid Reported By ID format.'),
    query('resolvedById').optional().isMongoId().withMessage('Invalid Resolved By ID format.'),
    query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer.'),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be an integer between 1 and 100.')
];

const reportIdValidation = [
    param('reportId', 'Invalid Report ID format').isMongoId()
];

const resolveReportValidation = [
    body('resolved').optional().isBoolean().withMessage('Resolved must be true or false.').toBoolean(),
    body('actionTaken').optional({ checkFalsy: true })
                     .isIn(reportActionTakenValues)
                     .withMessage(`Action taken must be one of: ${reportActionTakenValues.join(', ')}`),
    body('adminNotes').optional().trim().isLength({ max: 1000 })
                     .withMessage('Admin notes cannot exceed 1000 characters.')
];


router.post(
    '/',
    protect, 
    createReportValidation, 
    handleValidationErrors, 
    createReport 
);

router.get(
    '/',
    protect, 
    authorize(['admin']), 
    getReportsQueryValidation,
    handleValidationErrors, 
    getReports 
);

router.put(
    '/:reportId/resolve', 
    protect, 
    authorize(['admin']),  
    reportIdValidation, 
    resolveReportValidation,
    handleValidationErrors, 
    resolveReport
);

module.exports = router;
