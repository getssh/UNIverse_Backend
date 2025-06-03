const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Job title is required'],
            trim: true,
            maxlength: [200, 'Job title cannot exceed 200 characters']
        },
        field: {
            type: String,
            required: [true, 'Field is required'],
            trim: true
        },
        department: {
            type: String,
            required: [true, 'Department is required'],
            trim: true
        },
        jobType: {
            type: String,
            required: [true, 'Job type is required'],
            enum: ['full-time', 'part-time', 'contract', 'internship', 'temporary'],
            default: 'full-time'
        },
        skillLevel: {
            type: String,
            // required: [true, 'Skill level is required'],
            enum: ['Entry-level', 'Mid-career', 'Senior-level'],
            default: 'Entry-level'
        },
        location: {
            type: String,
            // required: [true, 'Location is required'],
            trim: true
        },
        company: {
            type: String,
            required: [true, 'Company name is required'],
            trim: true
        },
        salary: {
            type: Number,
            min: [0, 'Salary cannot be negative'],
            default: 0
        },
        deadline: {
            type: Date,
            // required: [true, 'Application deadline is required']
        },
        description: {
            type: String,
            // required: [true, 'Job description is required'],
            trim: true,
            maxlength: [5000, 'Description cannot exceed 5000 characters']
        },
        sourceLink: {
            type: String,
            // required: [true, 'Source link is required'],
            trim: true,
            match: [
                /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
                'Please provide a valid URL'
            ],
            default: 'https://www.hahu.jobs/'
        },
        postedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: [true, 'Job must be posted by a user']
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'closed'],
            default: 'active'
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

jobSchema.index({ title: 'text', field: 'text', department: 'text', company: 'text' });
jobSchema.index({ deadline: 1 });
jobSchema.index({ status: 1 });

const Job = mongoose.model('Job', jobSchema);

module.exports = Job; 