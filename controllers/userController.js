const User = require('../models/User');

/**
 * Retrieves user details by ID
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.userId - ID of the user to retrieve
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with user data or error message
 * @throws {Error} If user retrieval fails
 */
exports.getUserDetails = async (req, res, next) => {
  const { userId } = req.params; // Get user ID from request params

  try {
    const user = await User.findById(userId).select('-password'); // Exclude password field
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicUrl: user.profilePicUrl,
      }
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};
