const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

const Channel = require('../models/Channel');
const Post = require('../models/Post');
const Comment = require('../models/Comment');

const modelsMap = {
    Channel: Channel,
    Post: Post,
    Comment: Comment
};

exports.protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ success: false, error: 'Not authorized, user not found' });
            }

            next();

        } catch (error) {
            console.error('Token verification failed:', error.message);
             if (error.name === 'JsonWebTokenError') {
                  return res.status(401).json({ success: false, error: 'Not authorized, invalid token' });
             }
             if (error.name === 'TokenExpiredError') {
                 return res.status(401).json({ success: false, error: 'Not authorized, token expired' });
             }
            return res.status(401).json({ success: false, error: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Not authorized, no token provided' });
    }
};

exports.authorize = (systemRoles = [], resourceOptions = null) => {

    return async (req, res, next) => {
        if (!req.user) {
            console.error('Authorization Error: req.user not found.');
            return res.status(401).json({ success: false, error: 'User not authenticated for authorization check' });
        }

        const userRole = req.user.role;
        const userId = req.user.id;

        if (systemRoles.includes(userRole)) {
            return next();
        }

        if (!resourceOptions) {
            return res.status(403).json({
                success: false,
                error: `User role '${userRole}' is not authorized. Required roles: ${systemRoles.join(', ')}.`
            });
        }

        try {
            const { modelName, paramName, userField = 'createdBy' } = resourceOptions;

            if (!modelName || !paramName) {
                 console.error('Authorization Error: Invalid resourceOptions provided.', resourceOptions);
                 return res.status(500).json({ success: false, error: 'Server error: Invalid authorization configuration.' });
            }
            const Model = modelsMap[modelName];
            if (!Model) {
                 console.error(`Authorization Error: Model '${modelName}' not found in modelsMap.`);
                  return res.status(500).json({ success: false, error: 'Server error: Invalid resource model configuration.' });
            }

            const resourceId = req.params[paramName];

            if (!resourceId || !mongoose.Types.ObjectId.isValid(resourceId)) {
                return res.status(400).json({ success: false, error: `Invalid resource ID format for parameter: ${paramName}` });
            }

            const resource = await Model.findById(resourceId).select(userField).lean();

            if (!resource) {
                return res.status(404).json({ success: false, error: `${modelName} not found with ID: ${resourceId}` });
            }

            if (!resource[userField]) {
                 console.error(`Authorization Error: Field '${userField}' not found on ${modelName} document.`);
                 return res.status(403).json({ success: false, error: 'Not authorized to access this resource (ownership check failed).' });
            }

            if (resource[userField].equals(userId)) {
                return next();
            } else {
                return res.status(403).json({
                    success: false,
                    error: `User is not authorized to modify this ${modelName.toLowerCase()}.`
                });
            }
        } catch (error) {
            console.error('Authorization resource check error:', error);
            next(error);
        }
    };
};
