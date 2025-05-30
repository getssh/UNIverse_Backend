const express = require('express');
const router = express.Router();
const multer = require('multer');
const { 
  getUserDetails, 
  updateUser, 
  deleteUser, 
  forgotPassword, 
  resetPassword 
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// Configure multer for file uploads
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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * @route   GET api/users/:userId
 * @desc    Get user details by ID
 * @access  Private
 */
router.get('/:userId', protect, getUserDetails);

/**
 * @route   PUT api/users/:userId
 * @desc    Update user details
 * @access  Private
 */
router.put('/:userId', protect, upload.single('profilePic'), updateUser);

/**
 * @route   DELETE api/users/:userId
 * @desc    Delete user account
 * @access  Private
 */
router.delete('/:userId', protect, deleteUser);

/**
 * @route   POST api/users/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', upload.none(), forgotPassword);

/**
 * @route   POST api/users/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', upload.none(), resetPassword);

module.exports = router;
