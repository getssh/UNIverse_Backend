const express = require('express');
const router = express.Router();
const chatBotController = require('../controllers/chatBotController');

/**
 * @route   POST api/chatbot
 * @desc    Chat with the chatbot
 * @access  Private
 */
router.post('/', chatBotController);

module.exports = router;
