const User = require('../models/User');

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
