const express = require('express');
const router = express.Router();
const { getUserDetails } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware'); // Protect route with auth middleware

/**
 * @route   GET api/users/:userId
 * @desc    Get user details by ID
 * @access  Private
 */
router.get('/:userId', protect, getUserDetails);

module.exports = router;
