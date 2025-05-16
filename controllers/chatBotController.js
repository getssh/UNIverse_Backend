const { callHuggingFaceChatbot } = require('../utils/hugChatRequest');

const chatWithBot = async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const reply = await callHuggingFaceChatbot(message);
    res.status(200).json({ reply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { chatWithBot };
