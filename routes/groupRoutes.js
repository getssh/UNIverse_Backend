const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');

const {
    createGroup, getGroups, getGroupById, updateGroup, deleteGroup,
    joinOrRequestToJoinGroup, leaveGroup, getJoinRequests, manageJoinRequest,
    promoteToAdmin, demoteAdmin,
    promoteToModerator, demoteModerator, kickMember,getUserGroups,getUserCreatedGroups,getNonMemberGroups,joinGroupWithoutRequest,searchGroups
} = require('../controllers/groupController');

const { protect, authorize } = require('../middleware/authMiddleware');
const Group = require('../models/Group');
const groupTypes = Group.schema.path('groupType').enumValues;
const groupPrivacyOptions = Group.schema.path('privacy').enumValues;

const router = express.Router();

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload only images.'), false);
    }
};
const uploadGroupImages = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 3 * 1024 * 1024 }
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

const groupIdValidation = [param('groupId', 'Invalid Group ID format').isMongoId()];
const memberIdValidation = [param('memberId', 'Invalid Member ID format').isMongoId()];
const memberIdToKickValidation = [param('memberIdToKick', 'Invalid Member ID format').isMongoId()];
const adminIdValidation = [param('adminIdToRemove', 'Invalid Admin ID format').isMongoId()];
const moderatorIdValidation = [param('moderatorIdToRemove', 'Invalid Moderator ID format').isMongoId()];
const requestIdValidation = [param('requestId', 'Invalid Request User ID format').isMongoId()];


const createGroupBodyValidation = [
    body('name', 'Group name is required').trim().notEmpty().isLength({ max: 100 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('groupType', `Group type must be one of: ${groupTypes.join(', ')}`).isIn(groupTypes),
    body('privacy', `Privacy must be one of: ${groupPrivacyOptions.join(', ')}`).isIn(groupPrivacyOptions),
    body('university').optional().isMongoId().withMessage('Invalid University ID format.'),
    body('rules').optional().isArray().withMessage('Rules must be an array of strings.'),
    body('rules.*').optional().isString().trim().isLength({ max: 500 }).withMessage('Each rule cannot exceed 500 characters.'),
    body('tags').optional().isArray().withMessage('Tags must be an array of strings.'),
    body('tags.*').optional().isString().trim().toLowerCase().isLength({ max: 50 }).withMessage('Each tag cannot exceed 50 characters.')
];
const updateGroupBodyValidation = [
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('description').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
    body('groupType').optional().isIn(groupTypes),
    body('privacy').optional().isIn(groupPrivacyOptions),
    body('university').optional({ checkFalsy: true }).isMongoId(),
    body('rules').optional().isArray(),
    body('rules.*').optional().isString().trim().isLength({ max: 500 }),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString().trim().toLowerCase().isLength({ max: 50 })
];
const joinRequestBodyValidation = [
    body('message').optional().trim().isLength({ max: 200 }).withMessage('Join request message cannot exceed 200 characters.')
];
const manageJoinRequestBodyValidation = [
    body('action', "Action must be 'approve' or 'reject'").isIn(['approve', 'reject'])
];

const getGroupsQueryValidation = [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('type').optional().isIn(groupTypes),
    query('privacy').optional().isIn(groupPrivacyOptions),
    query('universityId').optional().isMongoId(),
    query('tag').optional().trim().toLowerCase(),
    query('search').optional().trim().escape(),
    query('sort').optional().isIn(['members', 'name', 'createdAt'])
];


/**
 * @route   POST api/groups
 * @desc    Create a new group
 * @access  Private
 */
router.route('/')
    .post(
        protect,
        uploadGroupImages.fields([
            { name: 'profilePic', maxCount: 1 },
            { name: 'coverPhoto', maxCount: 1 }
        ]),
        createGroupBodyValidation,
        handleValidationErrors,
        createGroup
    )
    .get(
        protect,
        getGroupsQueryValidation,
        handleValidationErrors,
        getGroups
    );

/**
 * @route   GET api/groups/:groupId
 * @desc    Get a group by ID
 * @access  Private
 */
router.route('/:groupId')
    .get(
        protect,
        groupIdValidation,
        handleValidationErrors,
        getGroupById
    )
    .put(
        protect,
        uploadGroupImages.fields([
            { name: 'profilePic', maxCount: 1 },
            { name: 'coverPhoto', maxCount: 1 }
        ]),
        groupIdValidation,
        updateGroupBodyValidation,
        handleValidationErrors,
        updateGroup
    )
    .delete(
        protect,
        groupIdValidation,
        handleValidationErrors,
        deleteGroup
    );

/**
 * @route   GET api/groups/user/:userId
 * @desc    Get user groups
 * @access  Private
 */
router.get(
    '/user/:userId',
    protect,
    param('userId', 'Invalid User ID format').isMongoId(),
    handleValidationErrors,
    getUserGroups
);

/**
 * @route   GET api/groups/user/:userId/created
 * @desc    Get user created groups
 * @access  Private
 */
router.get(
    '/user/:userId/created',
    protect,
    param('userId', 'Invalid User ID format').isMongoId(),
    handleValidationErrors,
    getUserCreatedGroups
);

/**
 * @route   GET api/groups/user/:userId/non-member
 * @desc    Get non-member groups
 * @access  Private
 */
router.get(
    '/user/:userId/non-member',
    protect,
    param('userId', 'Invalid User ID format').isMongoId(),
    handleValidationErrors,
    getNonMemberGroups
);


/**
 * @route   POST api/groups/:groupId/join
 * @desc    Join a group
 * @access  Private
 */
router.post(
    '/:groupId/join',
    protect,
    groupIdValidation,
    joinRequestBodyValidation,
    handleValidationErrors,
    joinOrRequestToJoinGroup
);

/**
 * @route   DELETE api/groups/:groupId/leave
 * @desc    Leave a group
 * @access  Private
 */
router.delete(
    '/:groupId/leave',
    protect,
    groupIdValidation,
    handleValidationErrors,
    leaveGroup
);

/**
 * @route   GET api/groups/:groupId/join-requests
 * @desc    Get join requests
 * @access  Private
 */
router.get(
    '/:groupId/join-requests',
    protect,
    groupIdValidation,
    handleValidationErrors,
    getJoinRequests
);

/**
 * @route   PUT api/groups/:groupId/join-requests/:requestId
 * @desc    Manage join request
 * @access  Private
 */
router.put(
    '/:groupId/join-requests/:requestId',
    protect,
    groupIdValidation,
    requestIdValidation,
    manageJoinRequestBodyValidation,
    handleValidationErrors,
    manageJoinRequest
);


/**
 * @route   PUT api/groups/:groupId/members/:memberId/promote-admin
 * @desc    Promote a member to admin
 * @access  Private
 */
router.put(
    '/:groupId/members/:memberId/promote-admin',
    protect,
    groupIdValidation,
    memberIdValidation,
    handleValidationErrors,
    promoteToAdmin
);

/**
 * @route   PUT api/groups/:groupId/admins/:adminIdToRemove/demote
 * @desc    Demote an admin
 * @access  Private
 */
router.put(
    '/:groupId/admins/:adminIdToRemove/demote',
    protect,
    groupIdValidation,
    adminIdValidation,
    handleValidationErrors,
    demoteAdmin
);

/**
 * @route   PUT api/groups/:groupId/members/:memberId/promote-moderator
 * @desc    Promote a member to moderator
 * @access  Private
 */
router.put(
    '/:groupId/members/:memberId/promote-moderator',
    protect,
    groupIdValidation,
    memberIdValidation,
    handleValidationErrors,
    promoteToModerator
);

/**
 * @route   PUT api/groups/:groupId/moderators/:moderatorIdToRemove/demote
 * @desc    Demote a moderator
 * @access  Private
 */
router.put(
    '/:groupId/moderators/:moderatorIdToRemove/demote',
    protect,
    groupIdValidation,
    moderatorIdValidation,
    handleValidationErrors,
    demoteModerator
);

/**
 * @route   DELETE api/groups/:groupId/members/:memberIdToKick/kick
 * @desc    Kick a member
 * @access  Private
 */
router.delete(
    '/:groupId/members/:memberIdToKick/kick',
    protect,
    groupIdValidation,
    memberIdToKickValidation,
    handleValidationErrors,
    kickMember
);

/**
 * @route   POST api/groups/:groupId/join-without-request
 * @desc    Join a group without request
 * @access  Private
 */
router.post(
    '/:groupId/join-without-request',
    protect,
    groupIdValidation,
    handleValidationErrors,
    joinGroupWithoutRequest
);

/**
 * @route   GET api/groups/search/:query
 * @desc    Search groups
 * @access  Private
 */
router.get(
  '/search/:query', // Changed to use URL parameter
  protect,
  [
    param('query')
      .trim()
      .notEmpty().withMessage('Search query is required')
      .isLength({ min: 1}).withMessage('Search query must be at least 1 characters'),
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
  searchGroups
);


module.exports = router;
