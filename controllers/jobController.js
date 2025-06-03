const Job = require('../models/Job');
const User = require('../models/User');

/**
 * Create a new job posting
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.createJob = async (req, res, next) => {
    try {
        const jobData = {
            ...req.body,
            postedBy: req.user.id
        };

        const job = await Job.create(jobData);

        res.status(201).json({
            success: true,
            job
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all jobs with filtering and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getJobs = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        const filter = { status: 'active' };
        if (req.query.field) filter.field = req.query.field;
        if (req.query.department) filter.department = req.query.department;
        if (req.query.jobType) filter.jobType = req.query.jobType;
        if (req.query.skillLevel) filter.skillLevel = req.query.skillLevel;
        if (req.query.search) {
            filter.$text = { $search: req.query.search };
        }

        const jobs = await Job.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('postedBy', 'name email');

        const total = await Job.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: jobs.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            jobs
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single job by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getJob = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params._id)
            .populate('postedBy', 'name email');

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        res.status(200).json({
            success: true,
            job
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update a job posting
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.updateJob = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to update this job'
            });
        }

        const updatedJob = await Job.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        ).populate('postedBy', 'name email');

        res.status(200).json({
            success: true,
            job: updatedJob
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a job posting
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.deleteJob = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            });
        }

        if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to delete this job'
            });
        }

        await job.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Job deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get jobs posted by a specific user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getUserJobs = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        const jobs = await Job.find({ postedBy: req.params.userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('postedBy', 'name email');

        const total = await Job.countDocuments({ postedBy: req.params.userId });

        res.status(200).json({
            success: true,
            count: jobs.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            jobs
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get jobs matching user's department
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getJobsByUserDepartment = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        const user = await User.findById(req.user.id);
        if (!user || !user.department) {
            return res.status(400).json({
                success: false,
                error: 'User department not found'
            });
        }

        const filter = { 
            status: 'active',
            department: user.department
        };

        if (req.query.jobType) filter.jobType = req.query.jobType;
        if (req.query.skillLevel) filter.skillLevel = req.query.skillLevel;
        if (req.query.search) {
            filter.$text = { $search: req.query.search };
        }

        const jobs = await Job.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('postedBy', 'name email');

        const total = await Job.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: jobs.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            jobs
        });
    } catch (error) {
        next(error);
    }
};
