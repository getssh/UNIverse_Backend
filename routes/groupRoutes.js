const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');

const {
    createGroup, getGroups, getGroupById, updateGroup, deleteGroup,
    joinOrRequestToJoinGroup, leaveGroup, getJoinRequests, manageJoinRequest,
    promoteToAdmin, demoteAdmin,
    promoteToModerator, demoteModerator, kickMember
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

router.post(
    '/:groupId/join',
    protect,
    groupIdValidation,
    joinRequestBodyValidation,
    handleValidationErrors,
    joinOrRequestToJoinGroup
);

router.delete(
    '/:groupId/leave',
    protect,
    groupIdValidation,
    handleValidationErrors,
    leaveGroup
);

router.get(
    '/:groupId/join-requests',
    protect,
    groupIdValidation,
    handleValidationErrors,
    getJoinRequests
);

router.put(
    '/:groupId/join-requests/:requestId',
    protect,
    groupIdValidation,
    requestIdValidation,
    manageJoinRequestBodyValidation,
    handleValidationErrors,
    manageJoinRequest
);


router.put(
    '/:groupId/members/:memberId/promote-admin',
    protect,
    groupIdValidation,
    memberIdValidation,
    handleValidationErrors,
    promoteToAdmin
);

router.put(
    '/:groupId/admins/:adminIdToRemove/demote',
    protect,
    groupIdValidation,
    adminIdValidation,
    handleValidationErrors,
    demoteAdmin
);

router.put(
    '/:groupId/members/:memberId/promote-moderator',
    protect,
    groupIdValidation,
    memberIdValidation,
    handleValidationErrors,
    promoteToModerator
);

router.put(
    '/:groupId/moderators/:moderatorIdToRemove/demote',
    protect,
    groupIdValidation,
    moderatorIdValidation,
    handleValidationErrors,
    demoteModerator
);

router.delete(
    '/:groupId/members/:memberIdToKick/kick',
    protect,
    groupIdValidation,
    memberIdValidation,
    handleValidationErrors,
    kickMember
);


module.exports = router;
