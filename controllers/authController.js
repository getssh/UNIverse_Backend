const User = require('../models/User');
const sendEmail = require('../utils/emailSender');
const crypto = require('crypto');
const uploadToCloudinary = require('../utils/cloudinaryUploader');
const jwt = require('jsonwebtoken');
// const cloudinary = require('../config/cloudinary');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const { analyzeIdCardWithOCR } = require('../utils/ocrUtils');


function determineRoleFromText(text) {
  if (!text) return null;

  const lowerText = text.toLowerCase();


  if (lowerText.includes('faculty id') || lowerText.includes('professor id') || lowerText.includes('staff id')) {
      return 'teacher';
  }
  if (lowerText.includes('teacher id') || lowerText.includes('instructor id')) {
      return 'teacher';
  }
  if (lowerText.includes('student id') || lowerText.includes('student card')) {
      return 'student';
  }


  if (lowerText.includes('faculty') || lowerText.includes('professor') || lowerText.includes('instructor')) {
      return 'teacher';
  }
  if (lowerText.includes('student')) {
      return 'student';
  }

  console.log('Could not determine role from OCR text.');
  return null;
}

exports.registerUser = async (req, res, next) => {
    const { name, email, password, role, university, department, faculty, studyLevel, gender, phoneNumber } = req.body;

    const profilePicFile = req.files?.profilePic?.[0]
    const idCardFile = req.files?.idCard?.[0]

    // if ((role === 'student' || role === 'teacher') && !idCardFile) {
    //      return res.status(400).json({ success: false, error: 'ID Card image is required for registration.' });
    // }

    if (!idCardFile) {
      return res.status(400).json({ success: false, error: 'ID Card image is required for registration and role assignment.' });
    }
    if (!name || !email || !password ) {
        return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    let idCardUploadResult;

    try {
        const existingUser = await User.findOne({ email: email.toLowerCase() }).session(session);
        if (existingUser) {
          await session.abortTransaction(); session.endSession();
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
                        idCardUploadResult = result;
                        console.log("ID Card Uploaded:", idCardUrl);
                    })
            );
        }

        await Promise.all(uploadPromises);
        console.log("File uploads completed.");

        if (!idCardUploadResult || !idCardUploadResult.public_id) {
          await session.abortTransaction(); session.endSession();
          if (profilePicUrl && profilePicUrl.includes('cloudinary')) { /*remove profile pic*/ }
          return res.status(500).json({ success: false, error: 'ID Card upload failed or did not return necessary data.' });
        }

        let determinedRole = null;
        let ocrText = null;
        try {
            ocrText = await analyzeIdCardWithOCR(idCardUploadResult.secure_url);
            if (ocrText) {
                determinedRole = determineRoleFromText(ocrText);
            }
        } catch (ocrError) {
            console.error('OCR processing step failed:', ocrError.message);
        }

        // if (!determinedRole) {
        //   await session.abortTransaction(); session.endSession();
        //   return res.status(400).json({ success: false, error: 'Could not determine role from ID card. Please try again with a clearer image.' });
        // }

        // if (role && role !== determinedRole) {
        //   await session.abortTransaction(); session.endSession();
        //   return res.status(400).json({ success: false, error: 'Role mismatch. Please use the role determined from the ID card.' });
        // }


        const user = new User({
            name,
            email: email.toLowerCase(),
            password,
            role: determinedRole || 'student',
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

        await user.save({ session });
        console.log(`User ${user.email} created successfully with ID: ${user._id}`);

        await session.commitTransaction();
        session.endSession();

        console.log(`User ${user.email} registered. Determined role: ${user.role}. ID Card verified: ${user.verified}`);

        const verificationUrl = `https://universe-backend-kpry.onrender.com//api/auth/verify-email/${verificationToken}`;
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

        // res.status(200).json({
        //      success: true,
        //      message: 'Email verified successfully! You can now log in.'
        //  });

        res.redirect(`${process.env.CLIENT_URL}/login`)

    } catch (error) {
        console.error("Email Verification Error:", error);
        next(error);
    }
};
