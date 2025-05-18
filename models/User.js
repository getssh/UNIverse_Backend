const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto'); 

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide your name'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email address',
        ],
        trim: true,
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [8, 'Password must be at least 8 characters long'],
        select: false, 
    },
    role: {
        type: String,
        enum: ['student', 'teacher', 'admin'],
        required: [true, 'Please specify a role (student or teacher)'],
    },
    university: {
        type: mongoose.Schema.ObjectId,
        ref: 'University',
        required: [true, "You must select a university"],
    },
    department: String,
    faculty: String,
    studyLevel: {
        type: String,
        enum: ['undergraduate', 'graduate', 'PhD'],
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other'],
    },
    phoneNumber: String,
    profilePicUrl: {
        type: String,
        default: 'https://res.cloudinary.com/dvtc6coe2/image/upload/w_1000,c_fill,ar_1:1,g_auto,r_max,bo_5px_solid_gray,b_rgb:262c35/v1747589687/profile_placeholder_hgefwu.jpg',
    },
    idCardUrl: String,
    verified: {
        type: Boolean,
        default: false,
    },
    accountStatus: {
        type: String,
        enum: ['active', 'waitVerification', 'inactive', 'banned', 'warned'],
        default: 'waitVerification',
    },
    isEmailVerified: {
        type: Boolean,
        default: false,
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    interests: [String],

    createdGroups: [{ type: mongoose.Schema.ObjectId, ref: 'Group' }],
    joinedGroups: [{ type: mongoose.Schema.ObjectId, ref: 'Group' }],
    joinedChannels: [{ type: mongoose.Schema.ObjectId, ref: 'Channel' }],
    likedPosts: [{ type: mongoose.Schema.ObjectId, ref: 'Post' }],
    dateJoined: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true
});


userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);

        next();
    } catch (error) {
        next(error);
    }
});


userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createVerificationToken = function() {
    const unhashedToken = crypto.randomBytes(32).toString('hex')

    this.verificationToken = crypto
        .createHash('sha256')
        .update(unhashedToken)
        .digest('hex');

    this.verificationTokenExpires = Date.now() + 15 * 60 * 1000;

    return unhashedToken;
};

const User = mongoose.model('User', userSchema)

module.exports = User;