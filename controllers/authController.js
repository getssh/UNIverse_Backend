const User = require('../models/User');
const sendEmail = require('../utils/emailSender');
const crypto = require('crypto'); 


exports.registerUser = async (req, res, next) => {
    const { name, email, password, role} = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
        return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    const user = new User({
        name,
        email: email.toLowerCase(),
        password,
        role,
    });

    const verificationToken = user.createVerificationToken();

    await user.save();

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

    const emailMessage = `
        <h1>Welcome to the University Platform!</h1>
        <p>Thanks for signing up, ${user.name}.</p>
        <p>Please click the link below to verify your email address and activate your account:</p>
        <p><a href="${verificationUrl}" target="_blank" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Verify Email Address</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p><a href="${verificationUrl}" clicktracking=off>${verificationUrl}</a></p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Best regards,<br/>The University Platform Team</p>
    `;

    try {
        await sendEmail({
            to: user.email,
            subject: 'Verify Your Email - University Platform',
            html: emailMessage,
            text: `Welcome ${user.name}! Please verify your email by visiting this link: ${verificationUrl}`
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful! Please check your email inbox (and spam folder) to verify your account.',
        });

    } catch (emailError) {
        console.error('CRITICAL: Failed to send verification email after user creation.', emailError);

        res.status(201).json({
            success: true,
            message: 'Registration successful, BUT the verification email could not be sent. Please contact support or use a "Resend Verification" option if available later.',
            warning: 'Email sending failed. Account requires verification.',
            userId: user._id
        });

    }
};
