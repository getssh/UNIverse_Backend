// controllers/jobController.js
const Job = require('../models/Job');
const { scrapeHahuJobs } = require('../services/jobScraper');

export const getJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const jobs = await Job.find({ isActive: true })
      .sort({ postedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalJobs = await Job.countDocuments({ isActive: true });

    res.json({
      success: true,
      data: jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalJobs,
        pages: Math.ceil(totalJobs / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch jobs' });
  }
};

export const scrapeJobs = async (req, res) => {
  try {
    const result = await scrapeHahuJobs();
    res.json(result);
  } catch (error) {
    console.error('Error scraping jobs:', error);
    res.status(500).json({ success: false, error: 'Failed to scrape jobs' });
  }
};

export const createJob = async (req, res) => {
  try {
    const job = await Job.create(req.body);
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(400).json({ success: false, error: 'Failed to create job' });
  }
};

export const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({ success: true, data: job });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch job' });
  }
};