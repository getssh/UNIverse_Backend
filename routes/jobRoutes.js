// routes/jobRoutes.js
const express = require('express');
import {
  getJobs,
  scrapeJobs,
  createJob,
  getJobById
} from '../controllers/jobController';

const router = express.Router();

router.get('/', getJobs);
router.get('/scrape', scrapeJobs);
router.post('/', createJob);
router.get('/:id', getJobById);

export default router;