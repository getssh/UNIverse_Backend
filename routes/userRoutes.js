const express = require('express');
const router = express.Router();
const { getUserDetails } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware'); // Protect route with auth middleware

// Route to get user details by ID
router.get('/:userId', protect, getUserDetails);

module.exports = router;
