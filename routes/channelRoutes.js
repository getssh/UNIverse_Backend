const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');

const {
    createChannel,
    getChannels,
    getChannelById,
    updateChannel,
    deleteChannel,
    joinChannel,
    leaveChannel,
    getChannelMembers,
    getUserChannels,
    getNonMemberChannels,
    searchChannels
} = require('../controllers/channelController');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload only images for the channel profile picture.'), false);
    }
};
const uploadProfilePic = multer({
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

const channelIdValidation = [
    param('channelId', 'Invalid Channel ID format').isMongoId()
];

const channelBodyValidation = [
    body('name').optional().trim().notEmpty().withMessage('Channel name cannot be empty.')
               .isLength({ max: 100 }).withMessage('Channel name cannot exceed 100 characters.'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters.'),
    body('university').optional().if(body('name').exists())
                     .isMongoId().withMessage('Valid University ID is required.'),

    body('channelType').optional()
                      .isIn(['general', 'official', 'departmental', 'course', 'club', 'announcement', 'other'])
                      .withMessage('Invalid channel type.'),
    body('isPublic').optional().isBoolean().withMessage('isPublic must be true or false.'),

    body('admin').optional().isMongoId().withMessage('Invalid User ID format for admin.')
];

const getChannelsQueryValidation = [
     query('page').optional().isInt({ min: 1 }).toInt(),
     query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
     query('universityId').optional().isMongoId(),
     query('channelType').optional().isIn(['general', 'official', 'departmental', 'course', 'club', 'announcement', 'other']),
     query('member').optional().isIn(['true', 'false']),
     query('rank').optional().isIn(['members']),
     query('sort').optional().isIn(['name', 'oldest', 'newest']),
];

const getMembersQueryValidation = [
     query('page').optional().isInt({ min: 1 }).toInt(),
     query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

/**
 * @route   POST api/channels
 * @desc    Create a new channel
 * @access  Private
 */
router.route('/')
    .post(
        protect,
        authorize('admin'),
        uploadProfilePic.single('profilePic'),

        body('name', 'Channel name is required for creation').trim().notEmpty(),
        body('university', 'University ID is required for creation').isMongoId(),
        body('channelType', 'Channel type is required for creation').notEmpty()
             .isIn(['general', "official", 'departmental', 'course', 'club', 'announcement', 'other']),
        channelBodyValidation,
        handleValidationErrors,
        createChannel
    )
    .get(
        protect,
        getChannelsQueryValidation,
        handleValidationErrors, 
        getChannels 
    );

/**
 * @route   GET api/channels/:channelId
 * @desc    Get a channel by ID
 * @access  Private
 */
router.route('/:channelId')
    .get(
        protect, 
        channelIdValidation, 
        handleValidationErrors,
        getChannelById 
    );

/**
 * @route   GET api/channels/user/:userId
 * @desc    Get channels by user ID
 * @access  Private
 */
router.route('/user/:userId')
    .get(
        protect,
        param('userId', 'Invalid User ID format').isMongoId(),
        handleValidationErrors,
        getUserChannels
    );
    
/**
 * @route   GET api/channels/non-member/:userId
 * @desc    Get non-member channels by user ID
 * @access  Private
 */
router.route('/non-member/:userId')
    .get(
        protect,
        param('userId', 'Invalid User ID format').isMongoId(),
        handleValidationErrors,
        getNonMemberChannels
    );

/**
 * @route   PUT api/channels/:channelId/update
 * @desc    Update a channel
 * @access  Private
 */
router.route('/:channelId/update')
    .put(
      protect,
      authorize(['admin'], {
          modelName: 'Channel',
          paramName: 'channelId',
          userField: 'admin'
      }),
      uploadProfilePic.single('profilePic'),
      channelIdValidation,
      channelBodyValidation,
      handleValidationErrors,
      updateChannel
    );

/**
 * @route   DELETE api/channels/:channelId/delete
 * @desc    Delete a channel
 * @access  Private
 */
router.route('/:channelId/delete') 
    .delete(
      protect,
      authorize(['admin'], {
          modelName: 'Channel',
          paramName: 'channelId',
          userField: 'admin'
      }),
      channelIdValidation,
      handleValidationErrors,
      deleteChannel
    );

/**
 * @route   POST api/channels/:channelId/join
 * @desc    Join a channel
 * @access  Private
 */
router.route('/:channelId/join')
    .post(
        protect,
        channelIdValidation,
        handleValidationErrors,
        joinChannel
    );

/**
 * @route   POST api/channels/:channelId/leave
 * @desc    Leave a channel
 * @access  Private
 */
router.route('/:channelId/leave')
    .post(
        protect,
        channelIdValidation,
        handleValidationErrors,
        leaveChannel
    );

/**
 * @route   GET api/channels/:channelId/members
 * @desc    Get channel members
 * @access  Private
 */
router.route('/:channelId/members')
    .get(
        protect,
        channelIdValidation,
        getMembersQueryValidation,
        handleValidationErrors,
        getChannelMembers
    );

/**
 * @route   GET api/channels/search/:query
 * @desc    Search channels
 * @access  Private
 */
router.get(
  '/search/:query', // Changed to use URL parameter
  protect,
  [
    param('query')
      .trim()
      .notEmpty().withMessage('Search query is required')
      .isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
      .toInt()
  ],
  handleValidationErrors,
 searchChannels
);

module.exports = router;