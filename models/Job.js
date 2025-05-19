// models/Job.js
const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  salary: {
    type: String,
    required: true
  },
  employmentType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  requirements: {
    type: [String],
    default: []
  },
  responsibilities: {
    type: [String],
    default: []
  },
  location: {
    type: String,
    required: true
  },
  postedAt: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    default: 'hahu-jobs'
  },
  sourceUrl: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema);

export default Job;