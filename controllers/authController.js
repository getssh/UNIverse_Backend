const User = require('../models/User');
const sendEmail = require('../utils/emailSender');
const crypto = require('crypto');
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const jwt = require('jsonwebtoken');

exports.registerUser = async (req, res, next) => {
    const { name, email, password, role, university, department, faculty, studyLevel, gender, phoneNumber } = req.body;

    const profilePicFile = req.files?.profilePic?.[0]
    const idCardFile = req.files?.idCard?.[0]

    // if ((role === 'student' || role === 'teacher') && !idCardFile) {
    //      return res.status(400).json({ success: false, error: 'ID Card image is required for registration.' });
    // }

    try {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
        }

        let profilePicUrl = null;
        let idCardUrl = null;
        let profilePicPublicId = null;
        let idCardPublicId = null;

        const uploadPromises = [];
        if (profilePicFile) {
            console.log("Uploading Profile Picture...");
            uploadPromises.push(
                uploadToCloudinary(profilePicFile.buffer, profilePicFile.originalname, 'profile_pictures', 'image')
                    .then(result => {
                         profilePicUrl = result.secure_url;
                         profilePicPublicId = result.public_id;
                         console.log("Profile Picture Uploaded:", profilePicUrl);
                        })
            );
        }
        if (idCardFile) {
             console.log("Uploading ID Card...");
            uploadPromises.push(
                uploadToCloudinary(idCardFile.buffer, idCardFile.originalname, 'id_cards', 'image')
                 .then(result => {
                        idCardUrl = result.secure_url;
                        idCardPublicId = result.public_id;
                        console.log("ID Card Uploaded:", idCardUrl);
                    })
            );
        }

        await Promise.all(uploadPromises);
        console.log("File uploads completed (if any).");

        const user = new User({
            name,
            email: email.toLowerCase(),
            password,
            role,
            university,
            department,
            faculty,
            studyLevel,
            gender,
            phoneNumber,
            profilePicUrl: profilePicUrl,
            idCardUrl: idCardUrl,
        });

        const verificationToken = user.createVerificationToken();

        await user.save();
        console.log(`User ${user.email} created successfully with ID: ${user._id}`);

        const verificationUrl = `${process.env.CLIENT_URL}/api/auth/verify-email/${verificationToken}`;
        const emailMessage = `
          <h1>Welcome to the UNIverse Platform!</h1>
          <p>Thanks for signing up, ${user.name}.</p>
          <p>Please click the link below to verify your email address and activate your account:</p>
          <p><a href="${verificationUrl}" target="_blank" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Verify Email Address</a></p>
          <p>Or copy and paste this URL into your browser:</p>
          <p><a href="${verificationUrl}" clicktracking=off>${verificationUrl}</a></p>
          <p>If you did not request this, please ignore this email.</p>
          <p>Best regards,<br/>The UNIverse Platform Team</p>
        `;

        try {
            await sendEmail({
              to: user.email,
              subject: 'Verify Your Email - University Platform',
              html: emailMessage,
              text: `Welcome ${user.name}! Please verify your email by visiting this link: ${verificationUrl}`
            });
            console.log(`Verification email sent to ${user.email}`);


            res.status(201).json({
                success: true,
                message: 'Registration successful! Please check your email to verify your account.',
            });

        } catch (emailError) {
            console.error('CRITICAL: Failed to send verification email after user creation and file uploads.', emailError);
            res.status(201).json({
                success: true,
                message: 'Registration successful, BUT the verification email could not be sent. Please contact support or use a "Resend Verification" option if available later.',
                warning: 'Email sending failed. Account requires verification.',
                userId: user._id
            });
        }

    } catch (error) {
         console.error("Registration Error:", error);
         // TODO: Implement Cloudinary cleanup on registration failure if necessary
        next(error);
    }
};

exports.loginUser = async (req, res, next) => {
  const { email, password } = req.body;

  try {
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

      if (!user) {
          return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      if (user.accountStatus !== 'active') {
          let errorMessage = 'Account is not active.';
          if (user.accountStatus === 'waitVerification') {
              errorMessage = 'Account not verified. Please check your email for the verification link.';
          } else if (user.accountStatus === 'inactive') {
              errorMessage = 'Your account is currently inactive. Please contact support.';
          } else if (user.accountStatus === 'banned') {
              errorMessage = 'Your account has been banned. Please contact support.';
          }
          return res.status(403).json({ success: false, error: errorMessage });
      }

      const isMatch = await user.comparePassword(password);

      if (!isMatch) {
          return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      const payload = {
          id: user._id, 
          role: user.role
      };

      const token = jwt.sign(
          payload,
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '5h' }
      );

      console.log(`User ${user.email} logged in successfully.`);

      const cookieOptions = {
        expires: new Date(Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRES_IN_DAYS || '1', 10) * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      };

      res.status(200)
        .cookie('token', token, cookieOptions)
        .json({
          success: true,
          token: token,
          user: {
              id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
              profilePicUrl: user.profilePicUrl
          }
      });

  } catch (error) {
      console.error("Login Error:", error);
      next(error);
  }
};

exports.verifyEmail = async (req, res, next) => {
    const { token } = req.params;

    if (!token) {
        return res.status(400).json({ success: false, error: 'Verification token not provided.' });
    }

    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    try {

        const user = await User.findOne({
            verificationToken: hashedToken,
        });

        if (!user) {
            return res.status(400).json({ success: false, error: 'Invalid or expired verification token.' });
        }

        if (user.isEmailVerified) {
             return res.status(400).json({ success: false, error: 'Email is already verified.' });
        }

        user.isEmailVerified = true;
        user.accountStatus = 'active'; 
        user.verificationToken = undefined; 
        user.verificationTokenExpires = undefined; 

        await user.save({ validateBeforeSave: false });

        console.log(`Email verified successfully for user: ${user.email}`);

        res.status(200).json({
             success: true,
             message: 'Email verified successfully! You can now log in.'
         });

        // TODO Redirect to frontend login page
        // res.redirect(`${process.env.CLIENT_URL}/login?verified=true`)

    } catch (error) {
        console.error("Email Verification Error:", error);
        next(error);
    }
};
