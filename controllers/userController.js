const User = require('../models/User');
const sendEmail = require('../utils/emailSender');
const crypto = require('crypto');
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const cloudinary = require('cloudinary').v2;

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

/**
 * Updates user details
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.userId - ID of the user to update
 * @param {Object} req.body - Request body containing update fields
 * @param {Object} req.files - Uploaded files
 * @param {Object} req.files.profilePic - Profile picture file
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with updated user data
 */
exports.updateUser = async (req, res, next) => {
  const { userId } = req.params;
  const allowedUpdates = ['name', 'email', 'department', 'faculty', 'studyLevel', 'gender', 'phoneNumber', 'interests'];
  const updates = {};
  const profilePicFile = req.file;
  const removeProfilePic = req.body.removeProfilePic === 'true';

  Object.keys(req.body).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to update this user' });
    }

    if (profilePicFile || removeProfilePic) {
      if (user.profilePicUrl.publicId) {
        try {
          await cloudinary.uploader.destroy(user.profilePicUrl.publicId);
          console.log('Old profile picture deleted from Cloudinary');
        } catch (error) {
          console.error('Error deleting old profile picture:', error);
        }
      }

      if (removeProfilePic) {
        updates.profilePicUrl = {
          url: 'https://res.cloudinary.com/dvtc6coe2/image/upload/w_1000,c_fill,ar_1:1,g_auto,r_max,bo_5px_solid_gray,b_rgb:262c35/v1747589687/profile_placeholder_hgefwu.jpg',
          publicId: null
        };
      } else if (profilePicFile) {
        try {
          const result = await uploadToCloudinary(
            profilePicFile.buffer,
            profilePicFile.originalname,
            'profile_pictures',
            'image'
          );
          
          updates.profilePicUrl = {
            url: result.secure_url,
            publicId: result.public_id
          };
          console.log('New profile picture uploaded to Cloudinary');
        } catch (error) {
          console.error('Error uploading new profile picture:', error);
          return res.status(500).json({
            success: false,
            error: 'Failed to upload profile picture. Please try again.'
          });
        }
      }
    }

    Object.assign(user, updates);
    await user.save();

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicUrl: user.profilePicUrl.url,
        ...updates
      }
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

/**
 * Deletes a user account
 * @param {Object} req - Express request object
 * @param {Object} req.params - Request parameters
 * @param {string} req.params.userId - ID of the user to delete
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response confirming deletion
 */
exports.deleteUser = async (req, res, next) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this user' });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User account deleted successfully'
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

/**
 * Initiates password reset process
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing email
 * @param {string} req.body.email - Email of the user requesting password reset
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response confirming reset email sent
 */
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email is required' 
    });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, error: 'No user found with that email address' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.passwordResetExpires = Date.now() + 20 * 60 * 1000; // 20 minutes

    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    const message = `
      <h1>Password Reset Request</h1>
      <p>You requested a password reset. Please click the link below to reset your password:</p>
      <p><a href="${resetUrl}" target="_blank" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
      <p>This link will expire in 20 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
      <p>Best regards,<br/>The UNIverse Platform Team</p>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        html: message,
        text: `You requested a password reset. Please visit this link to reset your password: ${resetUrl}`
      });

      res.status(200).json({
        success: true,
        message: 'Password reset email sent successfully'
      });
    } catch (emailError) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        error: 'There was an error sending the email. Please try again later.'
      });
    }
  } catch (error) {
    console.error(error);
    next(error);
  }
};

/**
 * Resets user password using reset token
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing reset token and new password
 * @param {string} req.body.token - Password reset token
 * @param {string} req.body.password - New password
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response confirming password reset
 */
exports.resetPassword = async (req, res, next) => {
  const { token, password } = req.body;

  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired password reset token'
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};
