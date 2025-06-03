const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const multer = require('multer');

const upload = multer();

const {
    createJob,
    getJobs,
    getJob,
    updateJob,
    deleteJob,
    getUserJobs,
    getJobsByUserDepartment
} = require('../controllers/jobController');


router.get('/', getJobs);

router.get('/department', protect, getJobsByUserDepartment);
router.get('/user/:userId', protect, getUserJobs);
router.post('/', upload.none(), protect, createJob);
router.put('/:id', upload.none(), protect, updateJob);
router.delete('/:id', protect, deleteJob);
router.get('/:id', getJob);

module.exports = router; 