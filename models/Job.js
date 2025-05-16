const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Job title is required.'],
      trim: true,
      maxlength: [200, 'Job title cannot exceed 200 characters.']
    },
    company: {
      type: String,
      required: [true, 'Company name is required.'],
      trim: true
    },
    location: {
      type: String,
      required: [true, 'Job location is required.'],
      trim: true
    },
    jobType: {
      type: String,
      enum: ['Full-Time', 'Part-Time', 'Contract', 'Temporary', 'Internship', 'Remote'],
      required: [true, 'Job type is required.']
    },
    salary: {
      type: String,
      trim: true,
      default: 'Not specified'
    },
    description: {
      type: String,
      required: [true, 'Job description is required.']
    },
    requirements: {
      type: String,
      required: false
    },
    benefits: {
      type: String,
      required: false
    },
    sourceUrl: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for short description (e.g., first 200 characters)
jobSchema.virtual('shortDescription').get(function () {
  return this.description?.slice(0, 200) + '...';
});

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
