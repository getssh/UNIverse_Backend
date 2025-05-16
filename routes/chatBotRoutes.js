const express = require('express');
const { chatWithBot } = require('../controllers/chatBotController');

const router = express.Router();

router.post('/', chatWithBot);

module.exports = router;
