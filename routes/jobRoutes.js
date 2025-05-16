const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');

router.get('/jobs', jobController.getAllJobs);
router.post('/jobs', jobController.createJob);

module.exports = router;
