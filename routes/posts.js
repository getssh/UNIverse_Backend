const express = require('express');
const multer = require('multer');
const path = require('path');

const { createPost } = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|pdf|doc|docx|txt|xls|xlsx|ppt|pptx/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype || extname) {
        cb(null, true);
    } else {
        cb(new Error(`File upload only supports the following filetypes: ${allowedTypes}`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 15 * 1024 * 1024
    }
});


router.post(
    '/',
    protect,
    upload.array('postFiles', 5),
    createPost
);

module.exports = router;